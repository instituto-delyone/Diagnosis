"use strict";

/*
 * Diagnosis — case controls.
 *
 * Keeps treatment permissive: a clinical action may be recorded even when
 * the diagnostic hypothesis is only syndromic or etiologically incomplete.
 * The engine may warn about a mismatch/known contraindication, but never
 * blocks the physician's action.
 */
(function (global) {
    const normalize = value => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const escapeHTML = value => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    function tokens(value) {
        return normalize(value).split(" ").filter(Boolean);
    }

    function overlaps(a, b) {
        const aa = new Set(tokens(a));
        const bb = new Set(tokens(b));
        return [...aa].filter(x => bb.has(x)).length;
    }

    function likelyTreatment(text) {
        const n = normalize(text);
        if (!n) return false;
        if (/^posso tratar|^posso iniciar|^posso prescrever|^qual tratamento/.test(n)) return false;
        return /\b(trat|prescrev|indico|inici|administ|repor|transfund|transfus|medic|terapia|conduta|manejo|dou alta|observar|internar|hidrata|oxigen|antibiot|cortico|analges|anticoagul|insulina|piridoxina|ferro)\w*/.test(n);
    }

    function likelyPrescription(text) {
        const n = normalize(text);
        if (!n) return false;
        if (/^qual |^posso |^como |^devo /.test(n)) return false;
        return /\b(prescrev|prescricao|receita|mg\b|mcg\b|ml\b|comprimido|capsula|ampola|dose|via oral|vo\b|iv\b|im\b|sc\b)\w*/.test(n);
    }

    const original = global.DiagnosisEngine?.prototype.processAction;
    if (!original || global.__diagnosisCaseControlsInstalled) return;
    global.__diagnosisCaseControlsInstalled = true;

    function plannedActions(caseData) {
        const management = caseData?.management;
        if (Array.isArray(management)) return management;
        if (Array.isArray(management?.possible_actions)) return management.possible_actions;
        if (Array.isArray(caseData?.possible_actions)) return caseData.possible_actions;
        return [];
    }

    global.DiagnosisEngine.prototype.processAction = async function (input) {
        if (likelyTreatment(input)) {
            const state = this.context || (this.context = {});
            state.managementActions = Array.isArray(state.managementActions) ? state.managementActions : [];
            state.managementActions.push({
                text: String(input).trim(),
                timestamp: Date.now()
            });

            const planned = plannedActions(this.currentCase);

            const best = planned
                .map(item => ({ item, overlap: overlaps(input, item) }))
                .sort((a, b) => b.overlap - a.overlap)[0];

            let warning = "";
            const contraindications = [
                ...(Array.isArray(this.currentCase?.contraindications) ? this.currentCase.contraindications : []),
                ...(Array.isArray(this.currentCase?.management_rules?.contraindications) ? this.currentCase.management_rules.contraindications : []),
                ...(Array.isArray(this.currentCase?.educational?.contraindications) ? this.currentCase.educational.contraindications : [])
            ];

            const hit = contraindications.find(item => overlaps(input, item) >= 2);
            if (hit) {
                warning = " Atenção: esta conduta encontra uma contraindicação/alerta registrado no caso. A conduta foi registrada e permanece sob decisão do médico.";
            } else if (best && best.overlap >= 2) {
                warning = " Conduta registrada; há correspondência com uma das condutas previstas no caso.";
            } else if (planned.length) {
                warning = " Conduta registrada. Ela não corresponde explicitamente às condutas previamente previstas neste caso; isso não bloqueia a execução.";
            } else {
                warning = " Conduta registrada. A avaliação de adequação clínica ocorrerá no encerramento.";
            }

            state.phase = "treatment";
            state.time = Number(state.time || 0) + 2;
            this.syncCompatibilityState?.();
            this.patientState?.record?.({
                type: "treatment",
                action: String(input).trim(),
                timestamp: Date.now()
            });
            this.log("CONDUTA", "Ação terapêutica registrada." + warning);
            this.renderState?.();
            if (likelyPrescription(input) && !state.caseEnded) {
                this.log("ENCERRAMENTO", "Prescrição registrada. O trabalho clínico deste caso foi concluído.");
                this.endCase?.({ reason: "prescricao" });
            }
            return;
        }

        return original.call(this, input);
    };

    global.DiagnosisEngine.prototype.endCase = function () {
        const state = this.context;
        if (!state || state.caseEnded) return state?.caseResult || null;

        const hypothesis = this.finalizeHypothesis?.() || null;
        const actions = Array.isArray(state.managementActions) ? state.managementActions : [];
        const planned = plannedActions(this.currentCase);

        const matchedActions = actions.filter(action =>
            planned.some(item => overlaps(action.text, item) >= 2)
        ).length;

        const actionScore = planned.length
            ? Math.round(Math.min(30, (matchedActions / Math.max(1, Math.min(planned.length, 3))) * 30))
            : 0;

        const hypothesisScore = Number(hypothesis?.score || state.hypothesis?.score || 0);
        const penalty = Math.min(20, Number(state.errors || 0) * 2);
        const total = Math.max(0, Math.min(100, Math.round(
            hypothesisScore * 0.7 + actionScore - penalty
        )));

        state.caseEnded = true;
        state.phase = "ended";
        state.caseResult = {
            hypothesisScore,
            actionScore,
            matchedActions,
            actionsCount: actions.length,
            errors: Number(state.errors || 0),
            penalty,
            total,
            elapsedSeconds: Math.max(0, (Date.now() - (state.startedAt || Date.now())) / 1000)
        };

        this.syncCompatibilityState?.();
        this.renderCaseResult?.();
        this.log(
            "ENCERRAMENTO",
            `Avaliação encerrada. Score geral: ${total}/100. Hipótese: ${hypothesisScore}/100. Conduta: ${actionScore}/30. Erros: ${Number(state.errors || 0)}.`
        );
        return state.caseResult;
    };

    global.DiagnosisEngine.prototype.renderCaseResult = function () {
        const root = document.getElementById("caseResult");
        if (!root) return;

        const result = this.context?.caseResult;
        if (!result) {
            root.classList.add("case-result-hidden");
            return;
        }

        root.classList.remove("case-result-hidden");
        root.innerHTML =
            '<div class="case-result-title">Avaliação encerrada</div>' +
            '<div class="case-result-score">' + escapeHTML(result.total) + '<span>/100</span></div>' +
            '<div class="case-result-grid">' +
                '<div><strong>Hipótese</strong><span>' + escapeHTML(result.hypothesisScore) + '/100</span></div>' +
                '<div><strong>Conduta</strong><span>' + escapeHTML(result.actionScore) + '/30</span></div>' +
                '<div><strong>Ações</strong><span>' + escapeHTML(result.actionsCount) + '</span></div>' +
                '<div><strong>Erros</strong><span>' + escapeHTML(result.errors) + '</span></div>' +
            '</div>' +
            '<div class="case-result-note">O caso segue o fluxo diagnóstico → terapêutico. O tratamento é liberado após o diagnóstico etiológico; alertas clínicos são registrados no log e integram a avaliação.</div>';

        if (this.elements?.input) this.elements.input.disabled = true;
        if (this.elements?.send) this.elements.send.disabled = true;
        if (this.elements?.hypothesisInput) this.elements.hypothesisInput.disabled = true;
        if (this.elements?.hypothesisSubmit) this.elements.hypothesisSubmit.disabled = true;
    };

    global.addEventListener("DOMContentLoaded", () => {
        const button = document.getElementById("endCaseBtn");
        const next = document.getElementById("nextBtn");
        const resultRoot = document.getElementById("caseResult");

        if (button) button.addEventListener("click", () => {
            const engine = global.idmtEngine;
            if (!engine || engine.context?.caseEnded) return;
            const result = engine.endCase?.();
            if (result) button.disabled = true;
        });

        if (next) next.addEventListener("click", () => {
            if (button) button.disabled = false;
            if (resultRoot) {
                resultRoot.classList.add("case-result-hidden");
                resultRoot.innerHTML = "";
            }
        });
    });
})(window);
