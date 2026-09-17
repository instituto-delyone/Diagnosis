/*
 * Diagnosis Clinical Enhancements
 *
 * Integration layer for Medical Library, natural Portuguese communication,
 * and fictional examination results. Kept outside engine.js to avoid making
 * the core engine unnecessarily large.
 */
(function (global) {
    "use strict";

    const CONFIG = {
        libraryScript: "Js/core/medical-library.js",
        conversationRules: "AI/CLINICAL_CONVERSATION_PT.json",
        examinationRules: "knowledge_base/examinations.json"
    };

    const normalize = value => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-diagnosis-enhancement="${src}"]`);
            if (existing) {
                if (existing.dataset.loaded === "true") return resolve();
                existing.addEventListener("load", resolve, { once: true });
                existing.addEventListener("error", reject, { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.dataset.diagnosisEnhancement = src;
            script.onload = () => {
                script.dataset.loaded = "true";
                resolve();
            };
            script.onerror = () => reject(new Error(`Não foi possível carregar ${src}`));
            document.head.appendChild(script);
        });
    }

    async function loadJSON(path) {
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
        return response.json();
    }

    function randomNumber(rule) {
        const min = Number(rule?.min);
        const max = Number(rule?.max);
        const decimals = Number(rule?.decimals || 0);
        const value = min + Math.random() * (max - min);
        return Number(value.toFixed(decimals));
    }

    function findExamination(rules, text) {
        const value = normalize(text);
        return (rules?.examinations || []).find(exam =>
            [exam.id, ...(exam.aliases || [])].some(alias => value.includes(normalize(alias)))
        ) || null;
    }

    function targetText(engine) {
        const hidden = engine?.currentCase?.hidden || {};
        const target = hidden.targetEntity || hidden.target || hidden.condition || "";
        try {
            return normalize(JSON.stringify(target));
        } catch (_) {
            return normalize(target);
        }
    }

    function findAssociation(exam, engine) {
        const target = targetText(engine);
        if (!target) return null;
        return (exam?.associations || []).find(association =>
            (association.concepts || []).some(concept => target.includes(normalize(concept)))
        ) || null;
    }

    function generateResult(exam, association) {
        const source = association?.pattern || exam.normal || {};
        const result = {};
        Object.entries(source).forEach(([key, rule]) => {
            result[key] = randomNumber(rule);
        });
        return result;
    }

    function formatResult(exam, result) {
        return Object.entries(result).map(([key, value]) => {
            const unit = exam?.units?.[key] || "";
            return `${key}: ${value}${unit ? ` ${unit}` : ""}`;
        }).join(" · ");
    }

    function applyExamination(engine, exam, association, result) {
        engine.patientState.investigations = engine.patientState.investigations || {};
        engine.patientState.investigations[exam.id] = {
            requested: true,
            result,
            findings: association?.findings || [],
            fictional: true,
            timestamp: Date.now()
        };

        engine.patientState.advanceTime("investigation");

        const findings = association?.findings || [];
        const findingText = findings.length
            ? ` Achados relevantes: ${findings.join(", ")}.`
            : " Não há alterações relevantes neste exame.";

        const message = `Certo. ${exam.id.charAt(0).toUpperCase() + exam.id.slice(1)} realizado. ${formatResult(exam, result)}.${findingText}`;

        engine.patientState.addFinding({
            type: "investigation",
            target: exam.id,
            value: result,
            findings,
            message
        });

        engine.patientState.record({
            type: "investigation",
            target: exam.id,
            result,
            findings,
            message,
            timestamp: Date.now()
        });

        engine.log("EXAME", message);
        engine.renderState();
        return true;
    }

    function install(engine) {
        if (!engine || engine.__clinicalEnhancementsInstalled) return;
        engine.__clinicalEnhancementsInstalled = true;

        const originalBoot = engine.boot.bind(engine);
        const originalProcessAction = engine.processAction.bind(engine);

        engine.boot = async function () {
            try {
                this.clinicalConversationRules = await loadJSON(CONFIG.conversationRules);
                this.examinationRules = await loadJSON(CONFIG.examinationRules);
            } catch (error) {
                console.warn("Regras clínicas auxiliares indisponíveis:", error);
            }

            try {
                await loadScript(CONFIG.libraryScript);
                if (typeof global.MedicalLibrary === "function") {
                    this.medicalLibrary = new global.MedicalLibrary();
                    await this.medicalLibrary.init();
                    await this.medicalLibrary.loadAll();
                    const summary = this.medicalLibrary.summary();
                    this.log("BIBLIOTECA", `Medical Library: ${summary.loaded}/${summary.sources} fontes carregadas e ${summary.chunks} chunks indexados.`);
                }
            } catch (error) {
                console.warn("Medical Library indisponível:", error);
                this.medicalLibrary = null;
            }

            await originalBoot();
        };

        engine.processAction = function (text) {
            const exam = findExamination(this.examinationRules, text);
            if (exam && this.patientState) {
                const association = findAssociation(exam, this);
                const result = generateResult(exam, association);
                applyExamination(this, exam, association, result);
                return;
            }

            originalProcessAction(text);
        };
    }

    function waitForEngine() {
        if (global.idmtEngine) {
            install(global.idmtEngine);
            return;
        }
        setTimeout(waitForEngine, 0);
    }

    waitForEngine();
})(window);
