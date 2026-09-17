"use strict";

/**
 * Runtime compatibility layer for the v3 knowledge/state contract.
 * Kept isolated so the legacy modules can be removed incrementally.
 */

(function (global) {

    function normalize(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    }

    function relationType(relation) {
        return relation?.type || relation?.relationship || relation?.relation || null;
    }

    if (typeof global.PatientState === "function") {
        const OriginalPatientState = global.PatientState;
        global.PatientState = function (initialState = {}) {
            const raw = initialState?.vitals || {};
            let bloodPressure = raw.blood_pressure || raw.bloodPressure || raw.pa || null;
            if (typeof bloodPressure === "string") {
                const match = bloodPressure.match(/(\d+)\s*\/\s*(\d+)/);
                bloodPressure = match ? { systolic: Number(match[1]), diastolic: Number(match[2]) } : null;
            }
            return new OriginalPatientState({
                ...initialState,
                vitals: {
                    heart_rate: raw.heart_rate ?? raw.heartRate ?? raw.fc ?? null,
                    respiratory_rate: raw.respiratory_rate ?? raw.respiratoryRate ?? raw.fr ?? null,
                    oxygen_saturation: raw.oxygen_saturation ?? raw.oxygenSaturation ?? raw.spo2 ?? raw.SpO2 ?? null,
                    blood_pressure: bloodPressure || { systolic: null, diastolic: null },
                    temperature: raw.temperature ?? raw.temp ?? null,
                    glucose: raw.glucose ?? raw.glicemia ?? null
                }
            });
        };
        global.PatientState.prototype = OriginalPatientState.prototype;
    }

    if (typeof global.ClinicalModel === "function") {
        const originalBuildIndexes = global.ClinicalModel.prototype.buildIndexes;
        global.ClinicalModel.prototype.buildIndexes = function () {
            this.relationships = this.relationships.map(relation => ({ ...relation, type: relationType(relation) }));
            return originalBuildIndexes.call(this);
        };
    }

    if (typeof global.PossibilityEngine === "function") {
        global.PossibilityEngine.prototype.getDiseaseEntities = function () {
            const allowed = new Set(["disease", "condition", "disorder", "syndrome", "diagnosis"]);
            return this.model.getEntities().filter(entity => {
                const type = normalize(entity?.type || entity?.entity_type || entity?.classification?.type);
                const category = normalize(entity?.category);
                return allowed.has(type) || allowed.has(category);
            });
        };

        global.PossibilityEngine.prototype.getPossibleManifestations = function (entityId) {
            const result = [];
            const source = this.model.getEntity(entityId);
            const relations = this.model.getRelationshipsFrom(entityId) || [];
            for (const relation of relations) {
                if (!["characterized_by", "manifests_as", "presents_with"].includes(relationType(relation))) continue;
                const target = relation.target || relation.target_id || relation.to;
                const entity = this.model.getEntity(target);
                if (entity) result.push({ entity, relationship: relation });
            }
            const clinical = source?.clinical;
            for (const presentation of Array.isArray(clinical?.presentations) ? clinical.presentations : []) {
                for (const finding of Array.isArray(presentation?.findings) ? presentation.findings : []) {
                    const id = typeof finding === "string" ? finding : finding?.id || finding?.entity_id || finding?.name;
                    if (!id) continue;
                    const entity = this.model.getEntity(id) || (typeof finding === "object" ? finding : { id, name: id, type: "finding" });
                    result.push({ entity, relationship: { type: "presents_with", source: entityId, presentation: presentation.id || null } });
                }
            }
            for (const symptom of Array.isArray(clinical?.symptoms) ? clinical.symptoms : []) {
                const id = typeof symptom === "string" ? symptom : symptom?.id || symptom?.entity_id || symptom?.name;
                if (!id) continue;
                const entity = this.model.getEntity(id) || (typeof symptom === "object" ? symptom : { id, name: id, type: "symptom" });
                result.push({ entity, relationship: { type: "presents_with", source: entityId } });
            }
            const generated = source?.patient_generation?.possible_presentations;
            for (const presentation of Array.isArray(generated) ? generated : []) {
                for (const feature of Array.isArray(presentation?.features) ? presentation.features : []) {
                    if (!feature) continue;
                    result.push({ entity: { id: String(feature), name: String(feature), type: "finding" }, relationship: { type: "presents_with", source: entityId } });
                }
            }
            const seen = new Set();
            return result.filter(item => {
                const key = item.entity?.id || item.entity?.name;
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        };
    }

    if (typeof global.PatientGenerator === "function") {
        global.PatientGenerator.prototype.generateOnset = function (disease, options = {}) {
            if (options.onset) return { ...options.onset };
            const sources = [disease?.patient_generation?.possible_presentations, disease?.clinical?.presentations, disease?.presentations];
            const timingText = sources.flatMap(value => Array.isArray(value) ? value : []).map(item => item?.timing || item?.onset || item?.id || "").join(" ").toLowerCase();
            let type = null;
            if (timingText.includes("crôn") || timingText.includes("cron")) type = "chronic";
            else if (timingText.includes("subagud") || timingText.includes("subacute")) type = "subacute";
            else if (timingText.includes("agud") || timingText.includes("acute")) type = "acute";
            type = options.onsetType || type || (options.mode === "emergency" ? "acute" : "subacute");
            let description = options.onsetDescription || null;
            if (!description && type === "acute") description = `há aproximadamente ${this.randomInt(1, 3)} horas`;
            if (!description && type === "subacute") description = `há aproximadamente ${this.randomInt(2, 7)} dias`;
            if (!description && type === "chronic") description = "de evolução crônica";
            return { type, description };
        };

        const originalHiddenState = global.PatientGenerator.prototype.generateHiddenState;
        global.PatientGenerator.prototype.generateHiddenState = function (disease, severity, options = {}) {
            const state = originalHiddenState.call(this, disease, severity, options) || {};
            return {
                ...state,
                riskFactors: Array.isArray(options.hiddenRiskFactors) ? [...options.hiddenRiskFactors] : state.riskFactors || [],
                etiology: options.hiddenEtiology ?? state.etiology ?? null,
                differential: Array.isArray(options.hiddenDifferentials) ? [...options.hiddenDifferentials] : state.differential || [],
                treatments: Array.isArray(options.hiddenTreatments) ? [...options.hiddenTreatments] : state.treatments || [],
                complications: Array.isArray(options.hiddenComplications) ? [...options.hiddenComplications] : state.complications || []
            };
        };

        const originalClinicalState = global.PatientGenerator.prototype.generateClinicalState;
        global.PatientGenerator.prototype.generateClinicalState = function (disease, severity, presentation = null) {
            const state = originalClinicalState.call(this, disease, severity) || {};
            state.onset = presentation?.onset?.type || state.onset || "subacute";
            return state;
        };

        const originalGenerate = global.PatientGenerator.prototype.generate;
        global.PatientGenerator.prototype.generate = function (options = {}) {
            const result = originalGenerate.call(this, options);
            if (result?.clinicalState && result?.presentation?.onset?.type) result.clinicalState.onset = result.presentation.onset.type;
            if (result?.hidden_state) {
                result.hidden_state = {
                    ...result.hidden_state,
                    riskFactors: result.riskFactors || result.hidden_state.riskFactors || [],
                    etiology: result.etiology ?? result.hidden_state.etiology ?? null,
                    differential: result.differentials || result.hidden_state.differential || [],
                    treatments: result.treatments || result.hidden_state.treatments || [],
                    complications: result.complications || result.hidden_state.complications || []
                };
            }
            return result;
        };
    }

    if (typeof global.ClinicalInterlocutor === "function") {
        global.ClinicalInterlocutor.prototype.hasAny = function (text, terms) {
            return terms.some(term => {
                const normalizedTerm = normalize(term);
                if (/^[a-z0-9]{1,3}$/i.test(normalizedTerm)) return new RegExp(`\\b${normalizedTerm}\\b`, "i").test(text);
                return text.includes(normalizedTerm);
            });
        };
        global.ClinicalInterlocutor.prototype.readPatientValue = function (target) {
            const state = this.patientState;
            if (!state) return undefined;
            const vitals = typeof state.getVitals === "function" ? state.getVitals() : state.vitals || {};
            const maps = {
                heart_rate: ["heart_rate", "heartRate", "fc"], respiratory_rate: ["respiratory_rate", "respiratoryRate", "fr"],
                spo2: ["oxygen_saturation", "oxygenSaturation", "spo2", "SpO2"], blood_pressure: ["blood_pressure", "bloodPressure", "pa"],
                glucose: ["glucose", "glicemia"], temperature: ["temperature", "temp"]
            };
            for (const key of maps[target] || [target]) if (vitals[key] !== undefined) return vitals[key];
            return undefined;
        };
        global.ClinicalInterlocutor.prototype.findPatientInformation = function (keys) {
            const state = this.patientState;
            if (!state) return undefined;
            const presentation = state.getPresentation?.() || {};
            const history = state.getHistory?.() || {};
            for (const source of [presentation, presentation.chief_complaint, history]) {
                for (const key of keys) if (source?.[key] !== undefined) return source[key];
            }
            return undefined;
        };
        global.ClinicalInterlocutor.prototype.findPhysicalExamination = function (target) {
            const exam = this.patientState?.getPhysicalExam?.() || {};
            return exam[target] !== undefined ? exam[target] : undefined;
        };
        global.ClinicalInterlocutor.prototype.interpretInvestigation = function (text) {
            if (!this.config.allowInvestigationRequests) return null;
            const definitions = Array.isArray(this.knowledgeBase?.entities) ? this.knowledgeBase.entities.filter(entity => normalize(entity?.type) === "investigation") : [];
            for (const definition of definitions) {
                const terms = [definition.id, definition.name, ...(Array.isArray(definition.aliases) ? definition.aliases : [])].filter(Boolean).map(normalize);
                if (terms.some(term => text.includes(term))) return this.requestInvestigation(definition.id);
            }
            return null;
        };
        global.ClinicalInterlocutor.prototype.findInvestigation = function (target) {
            const investigations = this.patientState?.getInvestigations?.() || {};
            const aliases = { ecg: ["ecg"], blood_gas: ["blood_gas"], hemogram: ["hemogram", "hemograma"], laboratory: ["laboratory"], ct: ["ct", "tc"], chest_xray: ["chest_xray"] };
            for (const key of aliases[target] || [target]) {
                if (investigations.results?.[key] !== undefined) return investigations.results[key];
                if (investigations[key] !== undefined) return investigations[key];
            }
            return undefined;
        };
    }

})(window);

/* =============================================================
   CLINICAL EXPERIENCE FLOW
   ============================================================= */

(function (global) {
    const engine = global.idmtEngine;
    if (!engine || engine.__clinicalExperienceFlowInstalled || typeof document === "undefined") return;

    engine.__clinicalExperienceFlowInstalled = true;
    engine.knowledgeStatus = [];
    engine.clinicalPhase = "diagnostic_hypothesis";
    engine.diagnosisAttempted = false;
    engine.diagnosisCorrect = false;
    engine.diagnosticHypothesisPoints = 10;

    const originalLoadKnowledge = engine.loadKnowledge.bind(engine);
    const originalRegisterKnowledgeSource = engine.registerKnowledgeSource.bind(engine);
    const originalGenerateCase = engine.generateCase.bind(engine);
    const originalProcessAction = engine.processAction.bind(engine);

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function titleFromPath(path) {
        const file = String(path || "").split("/").pop() || path;
        return file.replace(/\.json$/i, "")
            .replace(/_knowledge_base$/i, "")
            .replace(/_v\d+(?:\.\d+)*$/i, "")
            .replace(/_/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function ensureUI() {
        if (!document.getElementById("clinicalExperiencePanel")) {
            const panel = document.createElement("section");
            panel.id = "clinicalExperiencePanel";
            panel.className = "clinical-experience-panel";
            panel.innerHTML = `
                <div class="clinical-experience-header">
                    <div>
                        <div class="clinical-experience-title">Desafio clínico</div>
                        <div id="clinicalPhaseMessage" class="clinical-experience-subtitle"></div>
                    </div>
                    <div id="clinicalPhaseBadge" class="clinical-phase-badge">HIPÓTESE</div>
                </div>
                <div id="clinicalChallenge" class="clinical-challenge">Qual sua hipótese diagnóstica principal?</div>
            `;
            const intro = document.getElementById("caseIntro");
            intro?.parentElement?.insertBefore(panel, intro.nextSibling);
        }

        if (!document.getElementById("knowledgeStatusPanel")) {
            const panel = document.createElement("section");
            panel.id = "knowledgeStatusPanel";
            panel.className = "knowledge-status-panel";
            panel.innerHTML = `
                <div class="knowledge-status-header">
                    <div>
                        <div class="clinical-experience-title">Conhecimento clínico</div>
                        <div class="clinical-experience-subtitle">Verde somente após o JSON ser carregado e integrado ao motor.</div>
                    </div>
                    <div id="knowledgeStatusSummary" class="knowledge-status-summary">0 / 0</div>
                </div>
                <div id="knowledgeStatusList" class="knowledge-status-list"></div>
            `;
            const target = document.getElementById("clinicalExperiencePanel");
            target?.parentElement?.insertBefore(panel, target.nextSibling);
        }
    }

    function ensureStyles() {
        if (document.getElementById("clinicalExperienceStyles")) return;
        const style = document.createElement("style");
        style.id = "clinicalExperienceStyles";
        style.textContent = `
            .clinical-experience-panel,.knowledge-status-panel{margin:14px 20px;padding:15px 16px;background:rgba(8,21,34,.72);border:1px solid var(--border,#1d3a52);border-radius:12px}
            .clinical-experience-header,.knowledge-status-header{display:flex;align-items:center;justify-content:space-between;gap:12px}
            .clinical-experience-title{font-weight:800;letter-spacing:.02em}.clinical-experience-subtitle{margin-top:3px;color:var(--muted,#8fa7ba);font-size:11px;line-height:1.4}
            .clinical-phase-badge,.knowledge-status-summary{padding:5px 9px;border:1px solid var(--primary,#38bdf8);border-radius:999px;color:var(--primary,#38bdf8);font-size:10px;font-weight:800;letter-spacing:.08em}
            .clinical-challenge{margin-top:12px;padding:14px;border-left:3px solid var(--primary,#38bdf8);border-radius:0 9px 9px 0;background:rgba(56,189,248,.06);font-size:15px;font-weight:750;line-height:1.5}
            .clinical-experience-panel.phase-treatment .clinical-challenge{border-left-color:var(--success,#34d399);background:rgba(52,211,153,.06)}
            .clinical-experience-panel.phase-investigation .clinical-challenge{border-left-color:var(--warning,#fbbf24);background:rgba(251,191,36,.06)}
            .knowledge-status-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:7px;margin-top:12px}
            .knowledge-status-item{display:flex;align-items:center;gap:8px;min-width:0;padding:7px 9px;border:1px solid rgba(255,255,255,.05);border-radius:8px;background:rgba(255,255,255,.02);font-size:11px}
            .knowledge-status-dot{flex:0 0 auto;width:9px;height:9px;border-radius:50%;background:#64748b}.knowledge-status-item.loaded .knowledge-status-dot{background:var(--success,#34d399)}.knowledge-status-item.loading .knowledge-status-dot{background:var(--primary,#38bdf8)}.knowledge-status-item.error .knowledge-status-dot{background:var(--danger,#fb7185)}
            .knowledge-status-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.knowledge-status-detail{margin-left:auto;color:var(--muted,#8fa7ba);font-size:10px;white-space:nowrap}
        `;
        document.head.appendChild(style);
    }

    function renderKnowledgeStatus() {
        ensureUI(); ensureStyles();
        const list = document.getElementById("knowledgeStatusList");
        const summary = document.getElementById("knowledgeStatusSummary");
        if (!list) return;
        const statuses = engine.knowledgeStatus || [];
        const loaded = statuses.filter(item => item.status === "loaded").length;
        if (summary) summary.textContent = `${loaded} / ${statuses.length}`;
        list.innerHTML = statuses.map(item => {
            const detail = item.status === "loaded" ? "integrado" : item.status === "loading" ? "carregando" : item.error || "falha";
            return `<div class="knowledge-status-item ${escapeHTML(item.status)}" title="${escapeHTML(item.error || item.file)}"><span class="knowledge-status-dot"></span><span class="knowledge-status-name">${escapeHTML(item.label || titleFromPath(item.file))}</span><span class="knowledge-status-detail">${escapeHTML(detail)}</span></div>`;
        }).join("");
    }

    function setKnowledgeStatus(file, status, error = "") {
        let item = engine.knowledgeStatus.find(entry => entry.file === file);
        if (!item) {
            item = { file, label: titleFromPath(file), status: "loading", error: "" };
            engine.knowledgeStatus.push(item);
        }
        item.status = status;
        item.error = error;
        renderKnowledgeStatus();
    }

    function diagnosisTruth() {
        const state = engine.patientState;
        const hidden = state?.getInternalTruth?.() || state?.hidden_state || {};
        const internal = state?.get?.("internal_truth") || {};
        const caseHidden = engine.currentCase?.hidden_state || {};
        return hidden.diagnosis || internal.diagnosis || caseHidden.diagnosis || engine.currentCase?.condition?.id || null;
    }

    function findDiagnosisDefinition() {
        const diagnosis = diagnosisTruth();
        const model = engine.currentSource?.model;
        if (!diagnosis || !model) return null;
        return model.getEntity?.(diagnosis) || model.findEntity?.(diagnosis) || null;
    }

    function hypothesisMatches(text) {
        const value = normalize(text);
        const definition = findDiagnosisDefinition();
        const terms = [diagnosisTruth(), definition?.id, definition?.name, ...(Array.isArray(definition?.aliases) ? definition.aliases : [])]
            .filter(Boolean).map(normalize);
        return Boolean(value) && terms.some(term => term.length <= 3 ? new RegExp(`\\b${term}\\b`, "i").test(value) : value.includes(term));
    }

    function setPhase(phase) {
        engine.clinicalPhase = phase;
        ensureUI(); ensureStyles();
        const panel = document.getElementById("clinicalExperiencePanel");
        const challenge = document.getElementById("clinicalChallenge");
        const badge = document.getElementById("clinicalPhaseBadge");
        const message = document.getElementById("clinicalPhaseMessage");
        const input = document.getElementById("actionInput");
        if (!panel || !challenge) return;
        panel.classList.remove("phase-treatment","phase-investigation","phase-hypothesis");
        panel.classList.add(`phase-${phase === "diagnostic_hypothesis" ? "hypothesis" : phase}`);
        if (phase === "treatment") {
            badge.textContent = "TRATAMENTO"; challenge.textContent = "Qual tratamento você indica?";
            message.textContent = "Hipótese principal reconhecida. Agora assuma a conduta.";
            if (input) input.placeholder = "Descreva o tratamento indicado...";
        } else if (phase === "investigation") {
            badge.textContent = "INVESTIGAÇÃO"; challenge.textContent = "Adote a propedêutica necessária para esclarecer o diagnóstico.";
            message.textContent = "A hipótese ainda não pode ser confirmada com os dados disponíveis.";
            if (input) input.placeholder = "Solicite exame, investigação ou outra ação clínica...";
        } else {
            badge.textContent = "HIPÓTESE"; challenge.textContent = "Qual sua hipótese diagnóstica principal?";
            message.textContent = "Antes de seguir, registre a sua principal hipótese clínica.";
            if (input) input.placeholder = "Digite sua hipótese diagnóstica principal...";
        }
    }

    function flowLog(type, message, className) {
        engine.log(type, message);
        const last = engine.elements?.clinicalLog?.lastElementChild;
        if (last && className) last.classList.add(className);
    }

    function startCaseFlow() {
        engine.diagnosisAttempted = false; engine.diagnosisCorrect = false;
        setPhase("diagnostic_hypothesis");
        flowLog("DESAFIO DIAGNÓSTICO", "Qual sua hipótese diagnóstica principal?");
    }

    function handleHypothesis(text) {
        engine.diagnosisAttempted = true;
        if (hypothesisMatches(text)) {
            engine.diagnosisCorrect = true;
            engine.evaluation.add(engine.diagnosticHypothesisPoints);
            setPhase("treatment");
            flowLog("DIAGNÓSTICO", `Hipótese diagnóstica principal compatível com o diagnóstico do caso. +${engine.diagnosticHypothesisPoints} pontos.`, "success");
            flowLog("PRÓXIMA ETAPA", "Qual tratamento você indica?");
            engine.renderState();
            return;
        }
        engine.diagnosisCorrect = false;
        setPhase("investigation");
        flowLog("DIAGNÓSTICO", "Sua hipótese ainda não pode ser confirmada com os elementos disponíveis.", "warning");
        flowLog("PROPEDÊUTICA", "Adote a propedêutica necessária para esclarecer o diagnóstico.", "warning");
    }

    engine.loadKnowledge = async function () {
        ensureUI(); ensureStyles(); engine.knowledgeStatus = []; renderKnowledgeStatus();
        const originalFetch = global.fetch.bind(global);
        global.fetch = async (...args) => {
            const file = typeof args[0] === "string" ? args[0] : args[0]?.url || String(args[0] || "");
            setKnowledgeStatus(file, "loading");
            try {
                const response = await originalFetch(...args);
                if (!response.ok) setKnowledgeStatus(file, "error", `HTTP ${response.status}`);
                return response;
            } catch (error) {
                setKnowledgeStatus(file, "error", error?.message || "falha de rede");
                throw error;
            }
        };
        try { await originalLoadKnowledge(); }
        finally { global.fetch = originalFetch; }
        renderKnowledgeStatus();
    };

    engine.registerKnowledgeSource = function (json, file) {
        const before = engine.sources.length;
        const result = originalRegisterKnowledgeSource(json, file);
        if (engine.sources.length > before) setKnowledgeStatus(file, "loaded");
        else setKnowledgeStatus(file, "error", "JSON carregado, mas não foi integrado ao motor clínico.");
        return result;
    };

    engine.generateCase = async function () {
        const result = await originalGenerateCase();
        startCaseFlow();
        return result;
    };

    engine.processAction = function (text) {
        if (engine.clinicalPhase === "diagnostic_hypothesis") { handleHypothesis(text); return; }
        const interpreted = engine.clinicalInterlocutor?.interpret?.(text);
        const result = originalProcessAction(text);
        if (engine.clinicalPhase === "investigation" && interpreted?.recognized && interpreted.intent === "investigation") {
            setPhase("diagnostic_hypothesis");
            flowLog("NOVO DESAFIO", "Com os dados disponíveis agora, qual sua hipótese diagnóstica principal?");
        }
        return result;
    };

    ensureUI(); ensureStyles(); renderKnowledgeStatus(); setPhase("diagnostic_hypothesis");
})(window);
