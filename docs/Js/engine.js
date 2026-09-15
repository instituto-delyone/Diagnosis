/**
 * ============================================================
 * DIAGNOSIS ENGINE
 * IDMT Pró · Clinical Cognition Engine
 * ============================================================
 *
 * KNOWLEDGE
 *    ↓
 * POSSIBILITIES
 *    ↓
 * PATIENT
 *    ↓
 * PATIENT STATE
 *    ↓
 * CLINICAL INTERLOCUTOR
 *    ↓
 * CLINICAL ACTION
 *    ↓
 * CONSEQUENCE
 *    ↓
 * EVALUATION
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   CONFIGURAÇÃO
   ============================================================ */

const ARQUIVOS_POR_SALA = {
    vermelha: [
        "knowledge_base/cirurgia_4.json",
        "knowledge_base/hipertensao_arterial.json",
        "knowledge_base/neurologia.json",
        "knowledge_base/reumatologia.json",
        "knowledge_base/endocrinologia.json",
        "knowledge_base/cardiopatias.json",
        "knowledge_base/pneumologia.json"
    ],

    clinica: [
        "knowledge_base/cirurgia_4.json",
        "knowledge_base/hipertensao_arterial.json",
        "knowledge_base/neurologia.json",
        "knowledge_base/reumatologia.json",
        "knowledge_base/endocrinologia.json",
        "knowledge_base/cardiopatias.json",
        "knowledge_base/pneumologia.json"
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
        investigation: 8,
        diagnosis: 20,
        treatment: 25,
        support: 5,
        wrongDiagnosis: -8,
        redFlag: -30,
        irrelevant: -1,
        hint: -3
    }
};


/* ============================================================
   UTILITÁRIOS
   ============================================================ */

function normalize(value) {

    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[!?.,;:()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function clone(value) {

    return JSON.parse(JSON.stringify(value));
}


function randomItem(array) {

    if (!Array.isArray(array) || !array.length) {
        return null;
    }

    return array[Math.floor(Math.random() * array.length)];
}


function getArray(value) {

    if (Array.isArray(value)) {
        return value;
    }

    if (value === undefined || value === null) {
        return [];
    }

    return [value];
}


/* ============================================================
   INTENT ENGINE
   ============================================================ */

class IntentEngine {

    interpret(text) {

        const normalized = normalize(text);

        if (!normalized) {
            return {
                type: "UNKNOWN",
                raw: text
            };
        }


        /* ---------------- META ---------------- */

        if (
            normalized.includes("qual minha nota") ||
            normalized.includes("minha pontuacao") ||
            normalized.includes("minha pontuação") ||
            normalized.includes("quanto tirei") ||
            normalized.includes("score")
        ) {

            return {
                type: "REQUEST_SCORE",
                raw: text
            };
        }


        if (
            normalized.includes("dica") ||
            normalized.includes("me ajude") ||
            normalized.includes("me ajuda")
        ) {

            return {
                type: "REQUEST_HINT",
                raw: text
            };
        }


        if (
            normalized.includes("base cientifica") ||
            normalized.includes("base científica") ||
            normalized.includes("evidencia") ||
            normalized.includes("evidência")
        ) {

            return {
                type: "REQUEST_INFORMATION",
                raw: text
            };
        }


        if (
            normalized.includes("seguimento") ||
            normalized.includes("follow up") ||
            normalized.includes("acompanhamento")
        ) {

            return {
                type: "REQUEST_FOLLOW_UP",
                raw: text
            };
        }


        if (
            normalized === "fim" ||
            normalized.includes("encerrar caso") ||
            normalized.includes("finalizar caso")
        ) {

            return {
                type: "REQUEST_FINISH",
                raw: text
            };
        }


        return {
            type: "CLINICAL_ACTION",
            raw: text
        };
    }
}


/* ============================================================
   PATIENT STATE
   ============================================================ */

class PatientState {

    constructor(patientCase) {

        this.case = patientCase;

        this.stability =
            Number(patientCase?.stability) ||
            Number(patientCase?.initialStability) ||
            75;

        this.time = 0;

        this.actions = [];

        this.findings = [];

        this.hypotheses = [];

        this.diagnosisEstablished = false;

        this.treatmentPerformed = false;

        this.completed = false;

        this.helpUsed = 0;

        this.criticalErrors = 0;

        this.revealedInformation = [];

        this.investigations = {};

        this.vitals = this.extractVitals(patientCase);

        this.hidden = this.extractHiddenState(patientCase);
    }


    extractVitals(patientCase) {

        const candidates = [

            patientCase?.vitals,

            patientCase?.patient?.vitals,

            patientCase?.presentation?.vitals,

            patientCase?.state?.vitals,

            patientCase?.patientState?.vitals
        ];

        for (const candidate of candidates) {

            if (candidate && typeof candidate === "object") {
                return clone(candidate);
            }
        }

        return {};
    }


    extractHiddenState(patientCase) {

        const candidates = [

            patientCase?.hidden,

            patientCase?.patient?.hidden,

            patientCase?.state?.hidden,

            patientCase?.patientState?.hidden
        ];

        for (const candidate of candidates) {

            if (candidate && typeof candidate === "object") {
                return candidate;
            }
        }

        return {};
    }


    advanceTime(type = "unknown") {

        this.time += CONFIG.timeCost[type] || 1;

        this.actions.push({
            type: "time",
            action: type,
            time: this.time
        });
    }


    changeStability(delta) {

        this.stability += Number(delta) || 0;

        this.stability = Math.max(
            0,
            Math.min(100, this.stability)
        );
    }


    addFinding(finding) {

        if (!finding) {
            return;
        }

        this.findings.push(finding);

        this.revealedInformation.push(finding);
    }


    record(action) {

        this.actions.push(action);
    }
}


/* ============================================================
   EVALUATION
   ============================================================ */

class EvaluationEngine {

    constructor() {

        this.score = 0;
    }


    add(points) {

        this.score += Number(points) || 0;
    }


    evaluateInterlocutorResponse(response) {

        if (!response?.recognized) {

            this.add(CONFIG.score.irrelevant);

            return {
                points: CONFIG.score.irrelevant,
                success: false
            };
        }

        return {
            points: 0,
            success: true
        };
    }


    evaluateClinicalAction(intent, state) {

        if (!intent) {
            return {
                points: 0,
                success: false
            };
        }

        switch (intent.type) {

            case "REQUEST_SCORE":
            case "REQUEST_HINT":
            case "REQUEST_INFORMATION":
            case "REQUEST_FOLLOW_UP":
            case "REQUEST_FINISH":

                return {
                    points: 0,
                    success: true
                };

            default:

                return {
                    points: 0,
                    success: true
                };
        }
    }
}


/* ============================================================
   DIAGNOSIS ENGINE
   ============================================================ */

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

        this.model = null;

        this.possibilityEngine = null;

        this.patientGenerator = null;

        this.initialized = false;
    }


    /* ========================================================
       BOOT
       ======================================================== */

    async boot() {

        this.bindUI();

        this.setRoomLabel();

        this.log(
            "NOVO CASO",
            "Carregando ambiente clínico..."
        );

        await this.loadKnowledge();

        await this.generateCase();

        this.initialized = true;
    }


    /* ========================================================
       ROOM
       ======================================================== */

    getRoom() {

        const params = new URLSearchParams(
            window.location.search
        );

        return params.get("sala") === "vermelha"
            ? "vermelha"
            : "clinica";
    }


    setRoomLabel() {

        const element =
            document.getElementById("roomLabel");

        if (!element) {
            return;
        }

        element.textContent =
            this.room === "vermelha"
                ? "Sala Vermelha"
                : "Sala Clínica";
    }


    /* ========================================================
       LOAD KNOWLEDGE
       ======================================================== */

    async loadKnowledge() {

        const files =
            ARQUIVOS_POR_SALA[this.room] ||
            ARQUIVOS_POR_SALA.clinica;


        for (const file of files) {

            try {

                const response =
                    await fetch(file);

                if (!response.ok) {
                    throw new Error(
                        `HTTP ${response.status}`
                    );
                }

                const json =
                    await response.json();

                this.registerKnowledgeSource(
                    json,
                    file
                );

            } catch (error) {

                console.error(
                    "Erro carregando KB:",
                    file,
                    error
                );

                this.log(
                    "SISTEMA",
                    `Não foi possível carregar ${file}.`
                );
            }
        }


        if (!this.sources.length) {

            throw new Error(
                "Nenhuma Knowledge Base foi carregada."
            );
        }
    }


    registerKnowledgeSource(json, file) {

        /*
         * A arquitetura nova é preferencial.
         */

        try {

            let model = null;
            let possibilityEngine = null;
            let patientGenerator = null;


            if (
                typeof window.ClinicalModel ===
                "function"
            ) {

                model =
                    new window.ClinicalModel(json);
            }


            if (
                typeof window.PossibilityEngine ===
                "function"
            ) {

                possibilityEngine =
                    new window.PossibilityEngine(
                        model || json
                    );
            }


            if (
                typeof window.PatientGenerator ===
                "function"
            ) {

                patientGenerator =
                    new window.PatientGenerator(
                        possibilityEngine || model || json,
                        model || json
                    );
            }


            this.sources.push({

                file,

                raw: json,

                model,

                possibilityEngine,

                patientGenerator

            });

        } catch (error) {

            console.error(
                "Erro inicializando arquitetura clínica:",
                file,
                error
            );

            /*
             * Mesmo se uma camada não puder ser
             * inicializada, preservamos a KB.
             */

            this.sources.push({

                file,

                raw: json,

                model: null,

                possibilityEngine: null,

                patientGenerator: null

            });
        }
    }


    /* ========================================================
       GENERATE CASE
       ======================================================== */

    async generateCase() {

        const source =
            randomItem(this.sources);

        if (!source) {
            throw new Error(
                "Nenhuma fonte clínica disponível."
            );
        }

        this.currentSource = source;


        let generated = null;


        /*
         * PRIMEIRA OPÇÃO:
         * Patient Generator novo.
         */

        if (source.patientGenerator) {

            try {

                if (
                    typeof source.patientGenerator.generate ===
                    "function"
                ) {

                    generated =
                        await source.patientGenerator.generate({

                            room: this.room,

                            mode:
                                this.room === "vermelha"
                                    ? "emergency"
                                    : "clinical"

                        });
                }

            } catch (error) {

                console.error(
                    "Erro no PatientGenerator:",
                    error
                );
            }
        }


        /*
         * Algumas implementações podem utilizar
         * createPatient em vez de generate.
         */

        if (
            !generated &&
            source.patientGenerator &&
            typeof source.patientGenerator.createPatient ===
            "function"
        ) {

            try {

                generated =
                    await source.patientGenerator.createPatient({

                        room: this.room,

                        mode:
                            this.room === "vermelha"
                                ? "emergency"
                                : "clinical"
                    });

            } catch (error) {

                console.error(
                    "Erro no createPatient:",
                    error
                );
            }
        }


        /*
         * FALLBACK LOCAL
         *
         * Se o gerador não retornar algo,
         * ainda conseguimos criar uma experiência
         * mínima a partir da KB.
         */

        if (!generated) {

            generated =
                this.fallbackPatient(source.raw);
        }


        this.currentCase =
            this.normalizeGeneratedCase(
                generated,
                source
            );


        this.patientState =
            new PatientState(
                this.currentCase
            );


        /*
         * INTERLOCUTOR
         */

        if (
            typeof window.ClinicalInterlocutor ===
            "function"
        ) {

            this.clinicalInterlocutor =
                new window.ClinicalInterlocutor({

                    patientState:
                        this.patientState,

                    clinicalModel:
                        source.model,

                    knowledgeBase:
                        source.raw

                });

        } else {

            console.error(
                "ClinicalInterlocutor não carregado."
            );
        }


        this.renderInitialCase();
    }


    /* ========================================================
       NORMALIZAÇÃO DO PACIENTE
       ======================================================== */

    normalizeGeneratedCase(generated, source) {

        const value =
            generated?.patient ||
            generated?.case ||
            generated;


        const hidden =
            generated?.hidden ||
            value?.hidden ||
            generated?.clinicalState ||
            value?.clinicalState ||
            {};


        const vitals =
            generated?.vitals ||
            value?.vitals ||
            hidden?.vitals ||
            {};


        const presentation =
            generated?.presentation ||
            value?.presentation ||
            generated?.initialPresentation ||
            value?.initialPresentation ||
            {};


        return {

            id:
                generated?.id ||
                generated?.instanceId ||
                `patient_${Date.now()}`,

            room:
                this.room,

            difficulty:
                generated?.difficulty ||
                value?.difficulty ||
                "moderado",

            patient:
                value,

            presentation,

            vitals,

            hidden,

            investigations:
                generated?.investigations ||
                value?.investigations ||
                hidden?.investigations ||
                {},

            initialStability:
                generated?.initialStability ||
                value?.initialStability ||
                75,

            sourceFile:
                source.file,

            generatedProcedurally:
                true
        };
    }


    /* ========================================================
       FALLBACK
       ======================================================== */

    fallbackPatient(raw) {

        const entities =
            Array.isArray(raw?.entities)
                ? raw.entities
                : [];

        const entity =
            randomItem(entities);


        const patientGeneration =
            entity?.patient_generation ||
            entity?.patientGeneration ||
            {};


        const presentation =
            randomItem(
                getArray(
                    patientGeneration?.presentation_possibilities ||
                    patientGeneration?.presentationPossibilities
                )
            );


        return {

            id: `fallback_${Date.now()}`,

            difficulty: "moderado",

            patient: {

                age:
                    this.randomAge(
                        patientGeneration
                    ),

                sex:
                    randomItem([
                        "masculino",
                        "feminino"
                    ])
            },

            presentation:
                presentation || {
                    description:
                        "Apresentação clínica inicial ainda pouco caracterizada."
                },

            hidden: {

                targetEntity:
                    entity || null
            },

            vitals:
                this.generateFallbackVitals(),

            investigations: {},

            initialStability: 75
        };
    }


    randomAge(generation) {

        const age =
            generation?.age ||
            generation?.age_range ||
            generation?.ageRange;

        if (Array.isArray(age) && age.length >= 2) {

            const min =
                Number(age[0]) || 18;

            const max =
                Number(age[1]) || 90;

            return Math.floor(
                min +
                Math.random() *
                (max - min + 1)
            );
        }

        return Math.floor(
            18 +
            Math.random() * 73
        );
    }


    generateFallbackVitals() {

        return {

            heartRate:
                Math.floor(
                    60 +
                    Math.random() * 60
                ),

            spo2:
                Math.floor(
                    92 +
                    Math.random() * 7
                ),

            bloodPressure:
                `${Math.floor(
                    100 +
                    Math.random() * 30
                )}/${Math.floor(
                    60 +
                    Math.random() * 20
                )}`,

            glucose:
                Math.floor(
                    80 +
                    Math.random() * 50
                )
        };
    }


    /* ========================================================
       PROCESS ACTION
       ======================================================== */

    processAction(text) {

        if (!this.patientState) {

            this.log(
                "SISTEMA",
                "Nenhum paciente está ativo."
            );

            return;
        }


        const intent =
            this.intentEngine.interpret(text);


        /* ====================================================
           META
           ==================================================== */

        switch (intent.type) {

            case "REQUEST_SCORE":

                this.showScore();

                return;


            case "REQUEST_HINT":

                this.requestHint();

                return;


            case "REQUEST_INFORMATION":

                this.scientificBase();

                return;


            case "REQUEST_FOLLOW_UP":

                this.requestFollowUp();

                return;


            case "REQUEST_FINISH":

                this.finishCase();

                return;
        }


        /* ====================================================
           INTERLOCUTOR
           ==================================================== */

        if (
            intent.type === "CLINICAL_ACTION" &&
            this.clinicalInterlocutor
        ) {

            const response =
                this.clinicalInterlocutor.interpret(
                    text
                );


            if (response?.recognized) {

                this.applyInterlocutorResponse(
                    response
                );

                return;
            }
        }


        /*
         * Caso não tenha sido reconhecido
         * pelo interlocutor, mantemos uma resposta
         * clara em vez de fingir que entendemos.
         */

        this.evaluation.add(
            CONFIG.score.irrelevant
        );

        this.log(
            "INTERPRETAÇÃO",
            "Não consegui identificar uma ação clínica reconhecida."
        );
    }


    /* ========================================================
       APPLY INTERLOCUTOR RESPONSE
       ======================================================== */

    applyInterlocutorResponse(response) {

        const type =
            response.intent || "clinical";


        this.patientState.advanceTime(
            type
        );


        if (
            response.data?.revealed
        ) {

            this.patientState.addFinding({

                type,

                target:
                    response.target,

                value:
                    response.data.value ||
                    response.data.result ||
                    response.message,

                message:
                    response.message
            });
        }


        this.patientState.record({

            type,

            target:
                response.target,

            message:
                response.message,

            timestamp:
                Date.now()
        });


        this.log(
            "INTERLOCUTOR",
            response.message
        );


        /*
         * Atualiza a UI com os dados revelados.
         */

        this.updateRevealedVitals();


        this.renderState();
    }


    /* ========================================================
       UI
       ======================================================== */

    bindUI() {

        this.elements = {

            input:
                document.getElementById("actionInput"),

            send:
                document.getElementById("sendBtn"),

            hint:
                document.getElementById("hintBtn"),

            science:
                document.getElementById("scienceBtn"),

            next:
                document.getElementById("nextBtn"),

            back:
                document.getElementById("backBtn"),

            clinicalLog:
                document.getElementById("clinicalLog"),

            score:
                document.getElementById("score"),

            stabilityText:
                document.getElementById("stabilityText"),

            stabilityBar:
                document.getElementById("stabilityBar"),

            timeText:
                document.getElementById("timeText"),

            fc:
                document.getElementById("fc"),

            spo2:
                document.getElementById("spo2"),

            pa:
                document.getElementById("pa"),

            glucose:
                document.getElementById("glucose"),

            rr:
                document.getElementById("rr"),

            temp:
                document.getElementById("temp"),

            stateList:
                document.getElementById("stateList"),

            caseTitle:
                document.getElementById("caseTitle"),

            caseIntro:
                document.getElementById("caseIntro"),

            difficultyLabel:
                document.getElementById("difficultyLabel")
        };


        if (this.elements.send) {

            this.elements.send.addEventListener(
                "click",
                () => {

                    this.submitInput();

                }
            );
        }


        if (this.elements.input) {

            this.elements.input.addEventListener(
                "keydown",
                event => {

                    if (event.key === "Enter") {

                        event.preventDefault();

                        this.submitInput();
                    }
                }
            );
        }


        if (this.elements.hint) {

            this.elements.hint.addEventListener(
                "click",
                () => this.requestHint()
            );
        }


        if (this.elements.science) {

            this.elements.science.addEventListener(
                "click",
                () => this.scientificBase()
            );
        }


        if (this.elements.next) {

            this.elements.next.addEventListener(
                "click",
                () => this.generateCase()
            );
        }


        if (this.elements.back) {

            this.elements.back.addEventListener(
                "click",
                () => window.history.back()
            );
        }
    }


    submitInput() {

        const input =
            this.elements?.input;

        if (!input) {
            return;
        }


        const text =
            input.value.trim();

        if (!text) {
            return;
        }


        this.log(
            "VOCÊ",
            text
        );


        input.value = "";


        this.processAction(text);
    }


    /* ========================================================
       VITAIS INICIAIS
       ======================================================== */

    updateRevealedVitals() {

        if (!this.patientState) {
            return;
        }

        const vitals =
            this.patientState.vitals ||
            {};

        if (this.elements.fc) {
            this.elements.fc.textContent =
                this.formatDisplayVital(
                    "heart_rate",
                    vitals.heartRate ??
                    vitals.heart_rate ??
                    vitals.fc
                );
        }

        if (this.elements.rr) {
            this.elements.rr.textContent =
                this.formatDisplayVital(
                    "respiratory_rate",
                    vitals.respiratoryRate ??
                    vitals.respiratory_rate ??
                    vitals.fr
                );
        }

        if (this.elements.spo2) {
            this.elements.spo2.textContent =
                this.formatDisplayVital(
                    "spo2",
                    vitals.oxygenSaturation ??
                    vitals.oxygen_saturation ??
                    vitals.spo2 ??
                    vitals.SpO2
                );
        }

        if (this.elements.pa) {
            this.elements.pa.textContent =
                this.formatDisplayVital(
                    "blood_pressure",
                    vitals.bloodPressure ??
                    vitals.blood_pressure ??
                    vitals.pa
                );
        }

        if (this.elements.temp) {
            this.elements.temp.textContent =
                this.formatDisplayVital(
                    "temperature",
                    vitals.temperature ??
                    vitals.temp
                );
        }

        if (this.elements.glucose) {
            this.elements.glucose.textContent =
                this.formatDisplayVital(
                    "glucose",
                    vitals.glucose ??
                    vitals.glicemia
                );
        }
    }


        /* ========================================================
       INITIAL RENDER
       ======================================================== */

    renderInitialCase() {

        const patient =
            this.currentCase?.patient ||
            {};

        const presentation =
            this.currentCase?.presentation ||
            {};

        if (this.elements.caseTitle) {
            this.elements.caseTitle.textContent =
                "Novo paciente";
        }

        if (this.elements.caseIntro) {

            const age =
                patient.age ??
                patient.idade;

            const rawSex =
                patient.sex ??
                patient.sexo;

            const sexMap = {
                male: "masculino",
                female: "feminino",
                masculino: "masculino",
                feminino: "feminino"
            };

            const sex =
                sexMap[String(rawSex || "").toLowerCase()] ||
                rawSex;

            const complaint =
                presentation?.chief_complaint ||
                {};

            const symptoms =
                Array.isArray(complaint?.labels)
                    ? complaint.labels
                    : Array.isArray(complaint?.symptoms)
                        ? complaint.symptoms
                        : [];

            const narrative =
                complaint?.narrative ||
                presentation?.description ||
                presentation?.summary ||
                presentation?.text;

            const onset =
                presentation?.onset?.description;

            const symptomText =
                symptoms.length
                    ? symptoms.join(", ")
                    : "";

            const parts = [];

            if (age || sex) {
                parts.push(
                    `Paciente ${sex || ""}${
                        age ? `, ${age} anos` : ""
                    }.`
                );
            }

            if (narrative) {
                parts.push(narrative);
            } else if (symptomText) {
                parts.push(
                    `Queixa-se de ${symptomText}.`
                );
            }

            if (
                onset &&
                !narrative &&
                !String(onset).toLowerCase()
                    .includes(String(symptomText).toLowerCase())
            ) {
                parts.push(`Início: ${onset}.`);
            }

            /*
             * Não expomos diagnóstico, origem da KB,
             * severidade interna ou instruções de jogo.
             */

            this.elements.caseIntro.textContent =
                parts.join(" ") ||
                "Paciente admitido para avaliação clínica.";
        }

        if (this.elements.difficultyLabel) {
            this.elements.difficultyLabel.textContent =
                this.currentCase?.difficulty ||
                "moderado";
        }

        this.updateRevealedVitals();

        this.renderState();

        this.log(
            "NOVO PACIENTE",
            this.elements.caseIntro?.textContent ||
            "Paciente admitido para avaliação clínica."
        );
    }


    /* ========================================================
       STATE RENDER
       ======================================================== */

    renderState() {

        if (!this.patientState) {
            return;
        }


        if (this.elements.score) {

            this.elements.score.textContent =
                this.evaluation.score;
        }


        if (this.elements.stabilityText) {

            this.elements.stabilityText.textContent =
                `${Math.round(
                    this.patientState.stability
                )}%`;
        }


        if (this.elements.stabilityBar) {

            this.elements.stabilityBar.style.width =
                `${this.patientState.stability}%`;
        }


        if (this.elements.timeText) {

            this.elements.timeText.textContent =
                `${this.patientState.time} min`;
        }


        if (this.elements.stateList) {

            this.elements.stateList.innerHTML = `

                <li>
                    Contexto:
                    ${
                        this.room === "vermelha"
                            ? "emergency"
                            : "clinical"
                    }
                </li>

                <li>
                    Achados revelados:
                    ${
                        this.patientState
                            .findings.length
                    }
                </li>

                <li>
                    Ações executadas:
                    ${
                        this.patientState
                            .actions.length
                    }
                </li>

                <li>
                    Diagnóstico estabelecido:
                    ${
                        this.patientState
                            .diagnosisEstablished
                            ? "sim"
                            : "não"
                    }
                </li>

                <li>
                    Tratamento reconhecido:
                    ${
                        this.patientState
                            .treatmentPerformed
                            ? "sim"
                            : "não"
                    }
                </li>

                <li>
                    Erros críticos:
                    ${
                        this.patientState
                            .criticalErrors
                    }
                </li>

                <li>
                    Dicas utilizadas:
                    ${
                        this.patientState
                            .helpUsed
                    }
                </li>
            `;
        }
    }


    /* ========================================================
       LOG
       ======================================================== */

    log(type, message) {

        const log =
            this.elements?.clinicalLog;

        if (!log) {
            return;
        }


        const block =
            document.createElement("div");


        block.className =
            "clinical-log-entry";


        block.innerHTML = `

            <div class="clinical-log-type">
                ${type}
            </div>

            <div class="clinical-log-message">
                ${this.escapeHTML(message)}
            </div>

        `;


        log.appendChild(block);

        log.scrollTop =
            log.scrollHeight;
    }


    escapeHTML(value) {

        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* ========================================================
       META COMMANDS
       ======================================================== */

    showScore() {

        this.log(
            "PONTUAÇÃO",
            `Pontuação atual: ${this.evaluation.score}.`
        );
    }


    requestHint() {

        this.patientState.helpUsed++;

        this.evaluation.add(
            CONFIG.score.hint
        );


        this.log(
            "DICA",
            "Comece pela investigação que mais pode reduzir a incerteza diante da apresentação. (-3 pontos)"
        );


        this.renderState();
    }


    scientificBase() {

        this.log(
            "BASE CIENTÍFICA",
            "A base científica será apresentada a partir das fontes associadas ao conhecimento clínico utilizado pelo caso."
        );
    }


    requestFollowUp() {

        this.log(
            "SEGUIMENTO",
            "O seguimento será disponibilizado quando o estado clínico permitir transição para essa etapa."
        );
    }


    finishCase() {

        this.patientState.completed =
            true;


        this.log(
            "CASO FINALIZADO",
            `Pontuação final: ${this.evaluation.score}.`
        );


        this.renderState();
    }
}


/* ============================================================
   BOOT GLOBAL
   ============================================================ */

window.idmtEngine =
    new DiagnosisEngine();


window.addEventListener(
    "DOMContentLoaded",
    () => {

        window.idmtEngine
            .boot()
            .catch(error => {

                console.error(
                    "DIAGNOSIS ENGINE:",
                    error
                );

                const log =
                    document.getElementById(
                        "clinicalLog"
                    );

                if (log) {

                    log.innerHTML += `

                        <div class="clinical-log-entry">

                            <div class="clinical-log-type">
                                ERRO
                            </div>

                            <div class="clinical-log-message">
                                Não foi possível iniciar o ambiente clínico.
                            </div>

                        </div>

                    `;
                }
            });
    }
);
