"use strict";

/**
 * DIAGNOSIS ENGINE
 * Orquestra conhecimento, geração, estado, interlocução e investigação.
 *
 * O Engine não mantém uma implementação própria de PatientState.
 */

const ARQUIVOS_POR_SALA = {
    vermelha: [
        "knowledge_base/cirurgia_4.json",
        "knowledge_base/hipertensao_arterial.json",
        "knowledge_base/neurologia.json",
        "knowledge_base/reumatologia.json",
        "knowledge_base/endocrinologia.json",
        "knowledge_base/cardiopatias.json",
        "knowledge_base/pneumologia.json",
        "knowledge_base/diagnosis_kb_glicemia_consciencia_v1.json",
        "knowledge_base/diagnosis_kb_pulso_circulacao_v1.json",
        "knowledge_base/has_dislipidemia_knowledge_base.json",
        "knowledge_base/med_cm12_dispneia_knowledge_base.json"
    ],
    clinica: [
        "knowledge_base/cirurgia_4.json",
        "knowledge_base/hipertensao_arterial.json",
        "knowledge_base/neurologia.json",
        "knowledge_base/reumatologia.json",
        "knowledge_base/endocrinologia.json",
        "knowledge_base/cardiopatias.json",
        "knowledge_base/pneumologia.json",
        "knowledge_base/diagnosis_kb_glicemia_consciencia_v1.json",
        "knowledge_base/diagnosis_kb_pulso_circulacao_v1.json",
        "knowledge_base/has_dislipidemia_knowledge_base.json",
        "knowledge_base/med_cm12_dispneia_knowledge_base.json"
    ]
};

const CONFIG = {
    timeCost: {
        unknown: 1,
        vital: 1,
        patient_interaction: 1,
        physical_examination: 1,
        investigation: 5,
        diagnosis: 1,
        treatment: 2,
        support: 1,
        disposition: 3
    },
    score: {
        irrelevant: -1,
        hint: -3
    }
};

function clone(value) {
    if (value === undefined || value === null) return value;
    if (typeof structuredClone === "function") {
        try { return structuredClone(value); } catch (_) {}
    }
    return JSON.parse(JSON.stringify(value));
}

function normalize(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[!?.,;:()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if ([...document.scripts].some(script => script.src.endsWith(src))) {
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
        document.head.appendChild(script);
    });
}

class IntentEngine {
    interpret(text) {
        const value = normalize(text);
        if (!value) return { type: "UNKNOWN", raw: text };
        if (/qual minha nota|minha pontuacao|quanto tirei|\bscore\b/.test(value)) return { type: "REQUEST_SCORE", raw: text };
        if (/\bdica\b|me ajude|me ajuda/.test(value)) return { type: "REQUEST_HINT", raw: text };
        if (/base cientifica|evidencia/.test(value)) return { type: "REQUEST_INFORMATION", raw: text };
        if (/seguimento|follow up|acompanhamento/.test(value)) return { type: "REQUEST_FOLLOW_UP", raw: text };
        if (value === "fim" || value.includes("encerrar caso") || value.includes("finalizar caso")) return { type: "REQUEST_FINISH", raw: text };
        return { type: "CLINICAL_ACTION", raw: text };
    }
}

class EvaluationEngine {
    constructor() { this.score = 0; }
    add(points) { this.score += Number(points) || 0; }
}

class DiagnosisEngine {
    constructor() {
        this.room = this.getRoom();
        this.intentEngine = new IntentEngine();
        this.evaluation = new EvaluationEngine();
        this.sources = [];
        this.currentSource = null;
        this.currentCase = null;
        this.patientState = null;
        this.clinicalInterlocutor = null;
        this.investigationEngine = null;
        this.initialized = false;
        this.helpUsed = 0;
    }

    getRoom() {
        const params = new URLSearchParams(window.location.search);
        return params.get("sala") === "vermelha" ? "vermelha" : "clinica";
    }

    async boot() {
        this.bindUI();
        this.setRoomLabel();
        this.log("NOVO CASO", "Carregando ambiente clínico...");
        await this.loadRuntimeDependencies();
        await this.loadKnowledge();
        await this.generateCase();
        this.initialized = true;
    }

    async loadRuntimeDependencies() {
        const dependencies = [
            ["PatientState", "Js/core/patient-state.js"],
            ["ClinicalModel", "Js/core/clinical-model.js"],
            ["PossibilityEngine", "Js/core/possibility-engine.js"],
            ["PatientGenerator", "Js/core/patient-generator.js"],
            ["ClinicalInterlocutor", "Js/clinical/clinical-interlocutor.js"],
            ["InvestigationEngine", "Js/core/investigation-engine.js"]
        ];
        for (const [globalName, src] of dependencies) {
            if (typeof window[globalName] !== "function") await loadScript(src);
        }
        await loadScript("Js/core/clinical-runtime-adapter.js");
    }

    setRoomLabel() {
        const element = document.getElementById("roomLabel");
        if (element) element.textContent = this.room === "vermelha" ? "Sala Vermelha" : "Sala Clínica";
    }

    async loadKnowledge() {
        this.sources = [];
        const files = ARQUIVOS_POR_SALA[this.room] || ARQUIVOS_POR_SALA.clinica;
        for (const file of files) {
            try {
                const response = await fetch(file, { cache: "no-store" });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                this.registerKnowledgeSource(await response.json(), file);
            } catch (error) {
                console.error("Erro carregando KB:", file, error);
                this.log("SISTEMA", `Não foi possível carregar ${file}.`);
            }
        }
        if (!this.sources.length) throw new Error("Nenhuma Knowledge Base foi carregada.");
    }

    registerKnowledgeSource(json, file) {
        try {
            const model = new window.ClinicalModel(json);
            const possibilityEngine = new window.PossibilityEngine(model);
            const patientGenerator = new window.PatientGenerator(possibilityEngine);
            this.sources.push({ file, raw: json, model, possibilityEngine, patientGenerator });
        } catch (error) {
            console.error("Erro inicializando arquitetura clínica:", file, error);
        }
    }

    async generateCase() {
        const candidates = [...this.sources].sort(() => Math.random() - 0.5);
        let generated = null;
        let source = null;
        let lastError = null;
        for (const candidate of candidates) {
            try {
                const attempt = await candidate.patientGenerator.generate({ room: this.room, mode: this.room === "vermelha" ? "emergency" : "clinical" });
                if (this.isUsableGeneratedCase(attempt)) {
                    generated = attempt;
                    source = candidate;
                    break;
                }
            } catch (error) {
                lastError = error;
                console.warn("KB não gerou caso utilizável:", candidate.file, error);
            }
        }
        if (!generated) throw lastError || new Error("Nenhuma KB conseguiu gerar um caso clínico utilizável.");
        this.currentSource = source;
        this.currentCase = this.normalizeGeneratedCase(generated, source);
        this.patientState = new window.PatientState(this.currentCase);
        this.patientState.set("evolution.current_state.stability", this.currentCase.initialStability);
        this.clinicalInterlocutor = new window.ClinicalInterlocutor({ patientState: this.patientState, clinicalModel: source.model, knowledgeBase: source.raw });
        this.investigationEngine = new window.InvestigationEngine({ patientState: this.patientState, knowledgeBase: source.raw });
        this.renderInitialCase();
    }

    isUsableGeneratedCase(generated) {
        if (!generated || typeof generated !== "object") return false;
        const presentation = generated.presentation || {};
        const complaint = presentation.chief_complaint || {};
        const symptoms = complaint.symptoms || complaint.labels || [];
        return (Array.isArray(symptoms) && symptoms.length > 0) || Boolean(complaint.narrative);
    }

    normalizeGeneratedCase(generated, source) {
        const demographics = generated.demographics || {};
        const hidden = generated.hidden_state || generated.hidden || {};
        return {
            id: generated.id || `patient_${Date.now()}`,
            demographics,
            presentation: generated.presentation || {},
            history: clone(generated.history || {}),
            vitals: clone(generated.vitals || {}),
            physical_exam: clone(generated.physical_exam || {}),
            investigations: clone(generated.investigations || {}),
            hidden_state: clone(hidden),
            internal_truth: clone(generated.internal_truth || { diagnosis: hidden.diagnosis || generated.condition?.id || null, severity: hidden.severity || generated.severity || null, pathophysiology: hidden.pathophysiology || {}, complications: hidden.complications || [], differential: hidden.differential || [], evolution_model: hidden.evolution || {} }),
            clinicalState: clone(generated.clinicalState || {}),
            initialStability: Number(generated.initialStability ?? generated.vitals?.stability ?? 75),
            metadata: { case_id: generated.id || null, knowledge_base_id: source.file }
        };
    }

    processAction(text) {
        const intent = this.intentEngine.interpret(text);
        if (intent.type === "REQUEST_SCORE") return this.showScore();
        if (intent.type === "REQUEST_HINT") return this.requestHint();
        if (intent.type === "REQUEST_INFORMATION") return this.scientificBase();
        if (intent.type === "REQUEST_FOLLOW_UP") return this.requestFollowUp();
        if (intent.type === "REQUEST_FINISH") return this.finishCase();
        if (!this.patientState || !this.clinicalInterlocutor) return;
        const response = this.clinicalInterlocutor.interpret(text);
        if (!response?.recognized) {
            this.evaluation.add(CONFIG.score.irrelevant);
            this.log("INTERPRETAÇÃO", "Não consegui identificar uma ação clínica reconhecida.");
            return;
        }
        if (response.intent === "investigation" && this.investigationEngine) return this.handleInvestigation(response);
        this.recordClinicalResponse(response);
    }

    handleInvestigation(response) {
        const request = response.target || response.data?.investigation || response.data?.id;
        const result = this.investigationEngine.executeSync(request);
        this.recordClinicalResponse({
            ...response,
            message: result?.message || response.message,
            data: { ...response.data, result: result?.result ?? null, revealed: Boolean(result?.result) || Boolean(response.data?.revealed) },
            target: request
        });
    }

    recordClinicalResponse(response) {
        const cost = CONFIG.timeCost[response.intent] || CONFIG.timeCost.unknown;
        this.patientState.advanceTime(cost);
        this.patientState.addEvolutionEvent({ type: response.intent || "clinical_action", description: response.message, effects: response.data || [], metadata: { target: response.target || null } });
        if (response.data?.revealed) {
            const revealed = this.patientState.get("revealed.other") || [];
            this.patientState.set("revealed.other", [...revealed, { type: response.intent, target: response.target, value: response.data.value ?? response.data.result ?? response.message }]);
        }
        this.log("INTERLOCUTOR", response.message);
        this.updateRevealedVitals();
        this.renderState();
    }

    bindUI() {
        this.elements = {
            input: document.getElementById("actionInput"), send: document.getElementById("sendBtn"), hint: document.getElementById("hintBtn"), science: document.getElementById("scienceBtn"), next: document.getElementById("nextBtn"), back: document.getElementById("backBtn"), clinicalLog: document.getElementById("clinicalLog"), score: document.getElementById("score"), stabilityText: document.getElementById("stabilityText"), stabilityBar: document.getElementById("stabilityBar"), timeText: document.getElementById("timeText"), fc: document.getElementById("fc"), rr: document.getElementById("rr"), spo2: document.getElementById("spo2"), pa: document.getElementById("pa"), temp: document.getElementById("temp"), glucose: document.getElementById("glucose"), stateList: document.getElementById("stateList"), caseTitle: document.getElementById("caseTitle"), caseIntro: document.getElementById("caseIntro"), difficultyLabel: document.getElementById("difficultyLabel")
        };
        this.elements.send?.addEventListener("click", () => this.submitInput());
        this.elements.input?.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); this.submitInput(); } });
        this.elements.hint?.addEventListener("click", () => this.requestHint());
        this.elements.science?.addEventListener("click", () => this.scientificBase());
        this.elements.next?.addEventListener("click", () => this.generateCase());
        this.elements.back?.addEventListener("click", () => window.history.back());
    }

    submitInput() {
        const input = this.elements?.input;
        const text = input?.value?.trim();
        if (!text) return;
        this.log("VOCÊ", text);
        input.value = "";
        this.processAction(text);
    }

    updateRevealedVitals() {
        if (!this.patientState) return;
        const v = this.patientState.getVitals();
        const display = (element, value, unit) => { if (element) element.textContent = value == null ? `-- ${unit}` : `${value}${unit ? ` ${unit}` : ""}`; };
        display(this.elements.fc, v.heart_rate, "bpm");
        display(this.elements.rr, v.respiratory_rate, "irpm");
        display(this.elements.spo2, v.oxygen_saturation, "%");
        const bp = v.blood_pressure;
        display(this.elements.pa, bp?.systolic != null && bp?.diastolic != null ? `${bp.systolic}/${bp.diastolic}` : null, "");
        display(this.elements.temp, v.temperature, "°C");
        display(this.elements.glucose, v.glucose, "mg/dL");
    }

    renderInitialCase() {
        const p = this.currentCase.demographics || {};
        const c = this.currentCase.presentation?.chief_complaint || {};
        const symptoms = c.symptoms || c.labels || [];
        const narrative = c.narrative || this.currentCase.presentation?.description || "";
        if (this.elements.caseTitle) this.elements.caseTitle.textContent = "Novo paciente";
        if (this.elements.caseIntro) this.elements.caseIntro.textContent = `Paciente ${p.sex || ""}${p.age ? `, ${p.age} anos` : ""}. ${narrative || `Queixa-se de ${symptoms.join(", ")}.`}`.trim();
        if (this.elements.difficultyLabel) this.elements.difficultyLabel.textContent = this.currentCase.difficulty || "moderado";
        this.updateRevealedVitals();
        this.renderState();
        this.log("NOVO PACIENTE", this.elements.caseIntro?.textContent || "Paciente admitido para avaliação clínica.");
    }

    renderState() {
        if (!this.patientState) return;
        const stability = Number(this.patientState.get("evolution.current_state.stability")) || 0;
        const revealed = this.patientState.getRevealed();
        const events = this.patientState.getEvolutionEvents();
        if (this.elements.score) this.elements.score.textContent = this.evaluation.score;
        if (this.elements.stabilityText) this.elements.stabilityText.textContent = `${Math.round(stability)}%`;
        if (this.elements.stabilityBar) this.elements.stabilityBar.style.width = `${Math.max(0, Math.min(100, stability))}%`;
        if (this.elements.timeText) this.elements.timeText.textContent = `${this.patientState.getCurrentTime()} min`;
        if (this.elements.stateList) {
            const count = Object.values(revealed).reduce((n, value) => n + (Array.isArray(value) ? value.length : 0), 0);
            this.elements.stateList.innerHTML = `<li><span class="state-key">Informações reveladas</span><span class="state-value">${count}</span></li><li><span class="state-key">Eventos clínicos</span><span class="state-value">${events.length}</span></li><li><span class="state-key">Tempo clínico</span><span class="state-value">${this.patientState.getCurrentTime()} min</span></li><li><span class="state-key">Estado</span><span class="state-value">${this.patientState.getStatus()}</span></li>`;
        }
    }

    log(type, message) {
        const log = this.elements?.clinicalLog;
        if (!log) return;
        const block = document.createElement("div");
        block.className = "clinical-log-entry";
        block.innerHTML = `<div class="clinical-log-type">${this.escapeHTML(type)}</div><div class="clinical-log-message">${this.escapeHTML(message)}</div>`;
        log.appendChild(block);
        log.scrollTop = log.scrollHeight;
    }

    escapeHTML(value) {
        return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    showScore() { this.log("PONTUAÇÃO", `Pontuação atual: ${this.evaluation.score}.`); }
    requestHint() { this.helpUsed++; this.evaluation.add(CONFIG.score.hint); this.log("DICA", "Comece pela investigação que mais pode reduzir a incerteza diante da apresentação. (-3 pontos)"); this.renderState(); }
    scientificBase() { this.log("BASE CIENTÍFICA", "A base científica será apresentada a partir das fontes associadas ao conhecimento clínico utilizado pelo caso."); }
    requestFollowUp() { this.log("SEGUIMENTO", "O seguimento será disponibilizado quando o estado clínico permitir transição para essa etapa."); }
    finishCase() { this.patientState?.setStatus("completed"); this.log("CASO FINALIZADO", `Pontuação final: ${this.evaluation.score}.`); this.renderState(); }
}

window.idmtEngine = new DiagnosisEngine();
window.addEventListener("DOMContentLoaded", () => {
    window.idmtEngine.boot().catch(error => {
        console.error("DIAGNOSIS ENGINE:", error);
        const log = document.getElementById("clinicalLog");
        if (log) log.innerHTML += `<div class="clinical-log-entry"><div class="clinical-log-type">ERRO</div><div class="clinical-log-message">${String(error.message || "Não foi possível iniciar o ambiente clínico.").replace(/</g, "&lt;")}</div></div>`;
    });
});
