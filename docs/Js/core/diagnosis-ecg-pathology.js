"use strict";

/*
 * Diagnosis — ECG pathology renderer
 *
 * Policy:
 * - cardiac rhythm is derived from the prepared case's hidden pathology;
 * - if the case is not explicitly an ECG/rhythm-focused cardiac condition,
 *   the monitor remains sinusoidal;
 * - heart rate comes from the patient's revealed vital whenever possible.
 *
 * Synthetic educational signal only. It is not a diagnostic ECG.
 */
(function (global) {
    const normalize = value => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const $ = id => document.getElementById(id);

    function caseText(engine) {
        const c = engine?.currentCase || {};
        const h = c.hidden || {};
        return normalize([
            h.diagnosis,
            h.label,
            h.etiologic_diagnosis,
            h.syndromic_diagnosis,
            c.primary_concept,
            c.title,
            c.condition?.name,
            c.condition?.id
        ].filter(Boolean).join(" | "));
    }

    function classify(text) {
        if (/\b(bloqueio atrioventricular total|bloqueio av total|bloqueio atrioventricular de terceiro grau|bloqueio av de terceiro grau|bav total|bavt|terceiro grau)\b/.test(text)) {
            return "bavt";
        }

        if (/\b(wenckebach|mobitz i|mobitz 1|bloqueio atrioventricular de segundo grau|bloqueio av de segundo grau)\b/.test(text)) {
            return "mobitz1";
        }

        if (/\b(taquicardia supraventricular|taquicardia paroxistica supraventricular|tsv)\b/.test(text)) {
            return "svt";
        }

        if (/\b(iam com supradesnivelamento|iam com supra|infarto agudo do miocardio com supradesnivelamento|infarto com supra|stemi|supra de st)\b/.test(text)) {
            return "stemi";
        }

        if (/\b(bradicardia sinusal|bradicardia)\b/.test(text)) {
            return "brady";
        }

        if (/\b(taquicardia sinusal)\b/.test(text)) {
            return "tachy";
        }

        return "sinus";
    }

    function rateFromMonitor() {
        const raw = ($("fc")?.textContent || "").match(/\d+(?:\.\d+)?/);
        const n = raw ? Number(raw[0]) : NaN;
        return Number.isFinite(n) && n > 0 ? n : 75;
    }

    function gauss(x, c, w, a) {
        const z = (x - c) / w;
        return a * Math.exp(-0.5 * z * z);
    }

    function sinusValue(phase, rr) {
        return (
            gauss(phase, rr * .15, rr * .035, .14) +
            gauss(phase, rr * .455, rr * .010, -.16) +
            gauss(phase, rr * .500, rr * .008, 1.05) +
            gauss(phase, rr * .545, rr * .012, -.32) +
            gauss(phase, rr * .73, rr * .07, .30) +
            gauss(phase, rr * .91, rr * .035, .045)
        );
    }

    function svtValue(phase, rr) {
        return (
            gauss(phase, rr * .49, rr * .007, 1.05) +
            gauss(phase, rr * .54, rr * .010, -.30)
        );
    }

    function mobitzValue(t, rr) {
        const cycle = rr * 3.6;
        const pCenters = [0.12, 0.39, 0.66, 0.93].map(v => v * cycle);
        const qrsCenters = [0.20, 0.49, 0.79].map(v => v * cycle);
        let y = 0;

        for (const p of pCenters) y += gauss(t, p, cycle * .018, .14);

        // Progressive PR: QRS moves later after each P, then one P is not conducted.
        qrsCenters.forEach((q, i) => {
            y += gauss(t, q, cycle * .010, 1.05);
            y += gauss(t, q - cycle * .035, cycle * .013, -.16);
            y += gauss(t, q + cycle * .045, cycle * .014, -.30);
            y += gauss(t, q + cycle * .23, cycle * .075, .30);
        });

        return y;
    }

    function bavtValue(t, ventricularRR) {
        // Independent atrial oscillator: three P waves for every ventricular cycle.
        let y = 0;
        const atrialRR = ventricularRR / 3;

        for (let p = 0; p < 1300; p += atrialRR) {
            y += gauss(t, p, atrialRR * .055, .14);
        }

        for (let v = 60; v < 1400; v += ventricularRR) {
            y += gauss(t, v - ventricularRR * .035, ventricularRR * .012, -.16);
            y += gauss(t, v, ventricularRR * .008, 1.05);
            y += gauss(t, v + ventricularRR * .045, ventricularRR * .013, -.30);
            y += gauss(t, v + ventricularRR * .30, ventricularRR * .075, .30);
        }

        return y;
    }

    function stemiValue(phase, rr) {
        return (
            gauss(phase, rr * .15, rr * .035, .14) +
            gauss(phase, rr * .455, rr * .010, -.16) +
            gauss(phase, rr * .500, rr * .008, 1.05) +
            gauss(phase, rr * .545, rr * .012, -.34)
        ) + (phase > rr * .59 && phase < rr * .78 ? .42 : 0)
          + gauss(phase, rr * .86, rr * .075, .30);
    }

    function render(kind, rate) {
        const path = $("ecgSignalPath");
        const live = $("ecgLiveLabel");
        const footer = $("ecgFooterRate");
        const svg = $("ecgTrackSvg");
        if (!path || !live || !footer) return;

        let effectiveRate = rate;
        if (kind === "svt") effectiveRate = Math.max(120, Math.round(rate || 150));
        if (kind === "tachy") effectiveRate = Math.max(100, Math.round(rate || 150));
        if (kind === "brady") effectiveRate = Math.min(59, Math.round(rate || 40));
        if (kind === "mobitz1") effectiveRate = Math.max(50, Math.round(rate || 75));
        if (kind === "bavt") effectiveRate = Math.max(35, Math.round(rate || 60));

        const rr = 60000 / effectiveRate;
        const duration = rr * (kind === "bavt" ? 5.2 : 6.0);
        const samples = Math.ceil(duration / 8);
        const points = [];

        for (let i = 0; i <= samples; i++) {
            const t = (i / samples) * duration;
            let amplitude = 0;

            if (kind === "bavt") {
                amplitude = bavtValue(t, rr);
            } else if (kind === "mobitz1") {
                amplitude = mobitzValue(t % (rr * 3.6), rr);
            } else {
                const phase = ((t % rr) + rr) % rr;
                if (kind === "svt") amplitude = svtValue(phase, rr);
                else if (kind === "stemi") amplitude = stemiValue(phase, rr);
                else amplitude = sinusValue(phase, rr);
            }

            const x = (t / duration) * 2400;
            const y = 66 - amplitude * 31;
            points.push((i ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2));
        }

        path.setAttribute("d", points.join(" "));
        path.setAttribute("aria-label", "ECG " + kind + " simulado a " + Math.round(effectiveRate) + " bpm");

        const labels = {
            sinus: "RITMO SINUSAL",
            tachy: "TAQUICARDIA SINUSAL",
            brady: "BRADICARDIA SINUSAL",
            svt: "TAQUICARDIA SUPRAVENTRICULAR",
            mobitz1: "BAV 2º GRAU · WENCKEBACH",
            bavt: "BAVT · DISSOCIAÇÃO AV",
            stemi: "IAMCSST · SUPRA DE ST"
        };

        live.textContent = "LIVE · " + (labels[kind] || "RITMO SINUSAL");
        footer.textContent = "FC " + Math.round(effectiveRate) + " bpm · RR ≈ " + Math.round(rr) + " ms · ECG sintético";

        if (svg) {
            svg.dataset.ecgRhythm = kind;
            svg.dataset.heartRate = String(effectiveRate);
        }
    }

    let lastSignature = "";

    function sync() {
        const engine = global.idmtEngine;
        if (!engine?.currentCase) return;

        const text = caseText(engine);
        const kind = classify(text);
        const rate = rateFromMonitor();
        const signature = kind + "|" + Math.round(rate) + "|" + text;

        if (signature === lastSignature) return;
        lastSignature = signature;
        render(kind, rate);
    }

    global.addEventListener("DOMContentLoaded", () => {
        sync();
        setInterval(sync, 600);
    });

    global.DiagnosisECGPathology = {
        classify,
        render,
        sync
    };
})(window);
