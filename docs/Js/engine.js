"use strict";

/* ============================================================
   DIAGNOSIS ENGINE
   ============================================================

   NOVA ARQUITETURA

   Knowledge Base
        ↓
   KnowledgeBaseLoader
        ↓
   ClinicalModel
        ↓
   PossibilityEngine
        ↓
   PatientGenerator
        ↓
   Generated Patient
        ↓
   Patient State
        ↓
   Intent Engine
        ↓
   Clinical Action
        ↓
   Consequence
        ↓
   Evaluation

   Este engine NÃO utiliza API externa.
   Este engine NÃO utiliza LLM.
   Este engine NÃO transforma KB em casos fixos.

   ============================================================ */


/* ============================================================
   ARQUIVOS
   ============================================================ */

const ARQUIVOS_POR_SALA = {

    vermelha: [
        "knowledge_base/neurologia.json",
        "knowledge_base/reumatologia.json",
        "knowledge_base/endocrinologia.json",
        "knowledge_base/cardiopatias.json",
        "knowledge_base/pneumologia.json"
    ],

    clinica: [
        "knowledge_base/neurologia.json",
        "knowledge_base/reumatologia.json",
        "knowledge_base/endocrinologia.json",
        "knowledge_base/cardiopatias.json",
        "knowledge_base/pneumologia.json"
    ]

};


/* ============================================================
   CONFIG
   ============================================================ */

const CONFIG = {

    similarityThreshold: 0.42,

    timeCost: {
        unknown: 2,
        exam: 5,
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

function normalize(text) {

    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

}


function tokens(text) {

    const stopWords = new Set([

        "de", "da", "do",
        "das", "dos",
        "a", "o",
        "as", "os",
        "um", "uma",
        "para",
        "por",
        "em",
        "no", "na",
        "nos", "nas",
        "e", "ou",
        "que",
        "com", "sem",
        "me", "se",
        "ao", "aos",
        "peco", "solicito",
        "solicitar",
        "pedir",
        "fazer",
        "realizar",
        "avaliar"

    ]);

    return normalize(text)
        .split(" ")
        .filter(Boolean)
        .filter(token => !stopWords.has(token));

}


function similarity(a, b) {

    const A = new Set(tokens(a));
    const B = new Set(tokens(b));

    if (!A.size || !B.size) {
        return 0;
    }

    let intersection = 0;

    for (const token of A) {

        if (B.has(token)) {
            intersection++;
        }

    }

    return intersection /
        Math.max(A.size, B.size);

}


function containsPhrase(input, list) {

    const text = normalize(input);

    return (list || []).some(item => {

        const target = normalize(item);

        if (!target) {
            return false;
        }

        return (
            text.includes(target) ||
            target.includes(text)
        );

    });

}


/* ============================================================
   CSI
   ============================================================ */

const CSI = {

    exam: {

        ecg: [
            "ecg",
            "eletro",
            "eletrocardiograma",
            "tracado"
        ],

        gasometry: [
            "gasometria",
            "gaso",
            "gasometria arterial",
            "gasometria venosa"
        ],

        ct_head: [
            "tc de cranio",
            "tc cranio",
            "tomografia de cranio",
            "tomografia craniana",
            "tc sem contraste",
            "tomografia sem contraste",
            "tc de cabeca"
        ],

        ct_angio: [
            "angio-tc",
            "angiotc",
            "angio tc",
            "angiotomografia"
        ],

        mri: [
            "rm",
            "ressonancia",
            "ressonancia magnetica"
        ],

        laboratory: [
            "laboratorio",
            "labs",
            "exames de sangue",
            "hemograma",
            "ionograma",
            "funcao renal",
            "exames laboratoriais"
        ],

        glucose: [
            "glicemia",
            "glicose",
            "dextro",
            "hgt"
        ],

        cortisol: [
            "cortisol"
        ],

        acth: [
            "acth"
        ],

        aldosterone: [
            "aldosterona"
        ]

    },


    support: {

        oxygen: [
            "oxigenio",
            "o2",
            "cateter nasal",
            "mascara de oxigenio"
        ],

        nonInvasiveVentilation: [
            "vni",
            "ventilacao nao invasiva",
            "cpap",
            "bipap"
        ],

        intubation: [
            "intubacao",
            "iot",
            "tubo orotraqueal",
            "via aerea definitiva"
        ],

        venousAccess: [
            "acesso venoso",
            "acesso periferico",
            "acesso central"
        ]

    },


    treatment: {

        thrombolysis: [
            "trombolise",
            "alteplase",
            "rtpa",
            "rt-pa"
        ],

        thrombectomy: [
            "trombectomia",
            "trombectomia mecanica"
        ],

        anticoagulation: [
            "anticoagulacao",
            "heparina",
            "enoxaparina",
            "clexane"
        ],

        corticosteroid: [
            "corticoide",
            "corticoterapia",
            "hidrocortisona",
            "prednisolona",
            "dexametasona"
        ],

        hydration: [
            "hidratacao",
            "soro",
            "expansao",
            "sf 0.9",
            "solucao salina"
        ],

        sedation: [
            "sedacao",
            "sedativo",
            "diazepam",
            "midazolam",
            "propofol"
        ]

    },


    disposition: {

        discharge: [
            "alta",
            "mandar para casa",
            "liberar paciente"
        ],

        admission: [
            "internacao",
            "admitir",
            "leito",
            "uti",
            "cti"
        ],

        transfer: [
            "transferencia",
            "transferir",
            "regular"
        ]

    }

};


/* ============================================================
   INTENT ENGINE
   ============================================================ */

class IntentEngine {

    constructor() {

        this.patterns = {

            request_score: [
                "qual minha nota",
                "qual minha pontuacao",
                "quanto tirei",
                "como fui",
                "me avalie",
                "minha avaliacao",
                "resultado",
                "qual foi minha nota",
                "qual foi minha pontuacao"
            ],

            request_follow_up: [
                "qual o seguimento",
                "qual seguimento",
                "e agora",
                "o que faco agora",
                "o que faço agora",
                "proximo passo",
                "próximo passo",
                "como acompanhar",
                "seguimento",
                "follow up",
                "follow-up",
                "e depois",
                "depois disso"
            ],

            request_information: [
                "quais exames",
                "que exames",
                "quais informacoes",
                "quais informações",
                "o que eu sei",
                "o que sabemos",
                "quais dados",
                "me mostre os dados",
                "estado do paciente",
                "como esta o paciente",
                "como está o paciente",
                "dados disponiveis",
                "dados disponíveis"
            ],

            request_hint: [
                "dica",
                "me de uma dica",
                "me dê uma dica",
                "ajuda",
                "preciso de ajuda"
            ],

            request_finish: [
                "encerrar",
                "encerrar caso",
                "finalizar",
                "finalizar caso",
                "terminar caso",
                "terminar o caso",
                "sair do caso"
            ]

        };

    }


    matches(text, patterns) {

        const normalized =
            normalize(text);

        return patterns.some(
            pattern =>
                normalized.includes(
                    normalize(pattern)
                )
        );

    }


    interpret(text) {

        if (
            this.matches(
                text,
                this.patterns.request_score
            )
        ) {

            return {
                type: "REQUEST_SCORE",
                confidence: 1
            };

        }


        if (
            this.matches(
                text,
                this.patterns.request_follow_up
            )
        ) {

            return {
                type: "REQUEST_FOLLOW_UP",
                confidence: 1
            };

        }


        if (
            this.matches(
                text,
                this.patterns.request_information
            )
        ) {

            return {
                type: "REQUEST_INFORMATION",
                confidence: 0.95
            };

        }


        if (
            this.matches(
                text,
                this.patterns.request_hint
            )
        ) {

            return {
                type: "REQUEST_HINT",
                confidence: 1
            };

        }


        if (
            this.matches(
                text,
                this.patterns.request_finish
            )
        ) {

            return {
                type: "REQUEST_FINISH",
                confidence: 1
            };

        }


        return {
            type: "CLINICAL_ACTION",
            confidence: 0.7
        };

    }

}


/* ============================================================
   ACTION RESOLVER
   ============================================================ */

class ActionResolver {

    resolve(text, state) {

        const normalized =
            normalize(text);

        const intents = [];

        for (
            const [group, concepts]
            of Object.entries(CSI)
        ) {

            for (
                const [concept, synonyms]
                of Object.entries(concepts)
            ) {

                const found =
                    synonyms.some(
                        synonym =>
                            normalized.includes(
                                normalize(synonym)
                            )
                    );

                if (found) {

                    intents.push({

                        type:
                            this.mapType(group),

                        concept,

                        term:
                            text,

                        confidence:
                            1

                    });

                }

            }

        }


        /*
         * Diagnóstico explícito.
         *
         * A heurística antiga de "qualquer frase longa"
         * foi removida. Isso evita que frases como:
         *
         * "vou avaliar o eixo ACTH"
         *
         * sejam classificadas como diagnóstico.
         */

        if (
            this.looksLikeDiagnosis(text)
        ) {

            intents.push({

                type:
                    "diagnosis",

                concept:
                    "diagnosis_statement",

                term:
                    text,

                confidence:
                    0.8

            });

        }


        if (!intents.length) {

            return [{

                type: "unknown",
                concept: "unknown",
                term: text,
                confidence: 0

            }];

        }


        const unique = [];
        const seen = new Set();

        for (const intent of intents) {

            const key =
                `${intent.type}:${intent.concept}`;

            if (!seen.has(key)) {

                seen.add(key);
                unique.push(intent);

            }

        }

        return unique;

    }


    mapType(group) {

        if (group === "exam") {
            return "exam";
        }

        if (group === "treatment") {
            return "treatment";
        }

        if (group === "support") {
            return "support";
        }

        if (group === "disposition") {
            return "disposition";
        }

        return "unknown";

    }


    looksLikeDiagnosis(text) {

        const t = normalize(text);

        const expressions = [

            "diagnostico",
            "hipotese diagnostica",
            "hipotese",
            "suspeito de",
            "suspeita de",
            "compativel com",
            "trata-se de",
            "provavelmente",
            "considero que seja",
            "considero como"

        ];

        return expressions.some(
            expression =>
                t.includes(
                    normalize(expression)
                )
        );

    }

}


/* ============================================================
   PATIENT STATE
   ============================================================ */

class PatientState {

    constructor(patient, model, possibilityEngine) {

        this.patient =
            patient;

        this.model =
            model;

        this.possibilityEngine =
            possibilityEngine;

        this.stability =
            patient.vitals?.stability ??
            100;

        this.time =
            0;

        this.actions =
            [];

        this.findings =
            [];

        this.revealedFindings =
            [];

        this.hypotheses =
            [];

        this.diagnosisEstablished =
            false;

        this.treatmentPerformed =
            false;

        this.completed =
            false;

        this.helpUsed =
            0;

        this.criticalErrors =
            0;

        this.vitals = {

            fc:
                patient.vitals?.heartRate ??
                "—",

            spo2:
                patient.vitals?.oxygenSaturation ??
                "—",

            pa:
                patient.vitals?.bloodPressure ??
                "—",

            glucose:
                patient.vitals?.glucose ??
                "—"

        };

    }


    advanceTime(type) {

        this.time +=
            CONFIG.timeCost[type] ??
            CONFIG.timeCost.unknown;

    }


    changeStability(delta) {

        this.stability =
            Math.max(
                0,
                Math.min(
                    100,
                    this.stability + delta
                )
            );

    }


    addFinding(finding) {

        if (!finding) {
            return false;
        }

        const normalized =
            normalize(
                typeof finding === "string"
                    ? finding
                    : JSON.stringify(finding)
            );

        if (
            this.revealedFindings
                .some(
                    item =>
                        normalize(
                            String(item)
                        ) === normalized
                )
        ) {

            return false;

        }

        this.revealedFindings.push(
            finding
        );

        return true;

    }


    record(action) {

        this.actions.push({

            ...action,

            time:
                this.time

        });

    }

}


/* ============================================================
   CLINICAL ACTION / EVALUATION
   ============================================================ */

class ClinicalEvaluator {

    constructor(model, possibilityEngine) {

        this.model =
            model;

        this.engine =
            possibilityEngine;

    }


    getPatientDiseaseId(state) {

        return (
            state.patient.condition?.id ||
            null
        );

    }


    getDisease(state) {

        return this.model.getEntity(
            this.getPatientDiseaseId(state)
        );

    }


    entityText(entity) {

        if (!entity) {
            return "";
        }

        const parts = [

            entity.id,
            entity.name,
            entity.label,
            entity.canonical_name

        ];

        if (
            Array.isArray(entity.aliases)
        ) {

            parts.push(
                ...entity.aliases
            );

        }

        return parts
            .filter(Boolean)
            .join(" ");

    }


    actionMatchesEntity(
        input,
        entity
    ) {

        return (
            similarity(
                input,
                this.entityText(entity)
            ) >=
            CONFIG.similarityThreshold
        );

    }


    evaluateExam(
        input,
        state
    ) {

        const disease =
            this.getDisease(state);

        if (!disease) {

            return {
                kind: "neutral",
                points: 0,
                stability: 0,
                message:
                    "Não há condição clínica vinculada ao estado."
            };

        }


        const investigations =
            this.engine
                .getPossibleInvestigations(
                    disease.id
                );


        const selected =
            investigations.find(
                item =>
                    this.actionMatchesEntity(
                        input,
                        item.entity
                    )
            );


        if (!selected) {

            return {

                kind:
                    "neutral",

                points:
                    CONFIG.score.irrelevant,

                stability:
                    0,

                message:
                    "Investigação registrada, mas ela não está vinculada de forma reconhecível à condição clínica atual."

            };

        }


        /*
         * A investigação pode revelar um achado
         * já presente nas possibilidades do paciente.
         *
         * Não inventamos um resultado numérico.
         */

        const possible =
            state.patient.presentation || [];


        if (possible.length) {

            const unrevealed =
                possible.filter(
                    item =>
                        !state.revealedFindings
                            .some(
                                revealed =>
                                    JSON.stringify(
                                        revealed
                                    ) ===
                                    JSON.stringify(
                                        item
                                    )
                            )
                );


            if (unrevealed.length) {

                const finding =
                    unrevealed[0];

                state.addFinding(
                    finding
                );

                return {

                    kind:
                        "correct",

                    points:
                        CONFIG.score.investigation,

                    stability:
                        0,

                    message:
                        `Investigação adequada. Um novo achado clínico foi disponibilizado: ${describeClinicalObject(finding)}.`

                };

            }

        }


        return {

            kind:
                "correct",

            points:
                CONFIG.score.investigation,

            stability:
                0,

            message:
                "Investigação clinicamente relacionada à condição atual."

        };

    }


    evaluateDiagnosis(
        input,
        state
    ) {

        const disease =
            this.getDisease(state);

        if (!disease) {

            return {

                kind:
                    "neutral",

                points:
                    0,

                stability:
                    0,

                message:
                    "Não foi possível determinar a condição clínica do paciente."

            };

        }


        if (
            this.actionMatchesEntity(
                input,
                disease
            )
        ) {

            return {

                kind:
                    "correct",

                points:
                    CONFIG.score.diagnosis,

                stability:
                    0,

                message:
                    "Hipótese diagnóstica compatível com o estado clínico atual."

            };

        }


        const differentials =
            this.engine
                .getDifferentialEntities(
                    disease.id
                );


        const isDifferential =
            differentials.some(
                item =>
                    this.actionMatchesEntity(
                        input,
                        item.entity
                    )
            );


        if (isDifferential) {

            return {

                kind:
                    "wrong",

                points:
                    CONFIG.score.wrongDiagnosis,

                stability:
                    -3,

                message:
                    "Essa hipótese pertence ao espaço diferencial, mas não corresponde à condição clínica que está governando este paciente."

            };

        }


        return {

            kind:
                "neutral",

            points:
                CONFIG.score.irrelevant,

            stability:
                0,

            message:
                "Hipótese registrada, mas não corresponde ao modelo clínico atual."

        };

    }


    evaluateTreatment(
        input,
        state
    ) {

        const disease =
            this.getDisease(state);

        if (!disease) {

            return {

                kind:
                    "neutral",

                points:
                    0,

                stability:
                    0,

                message:
                    "Não há condição clínica definida para avaliar a conduta."

            };

        }


        const treatments =
            this.engine
                .getPossibleTreatments(
                    disease.id
                );


        const selected =
            treatments.find(
                item =>
                    this.actionMatchesEntity(
                        input,
                        item.entity
                    ) ||
                    similarity(
                        input,
                        this.entityText(
                            item.entity
                        )
                    ) >=
                    CONFIG.similarityThreshold
            );


        if (selected) {

            return {

                kind:
                    "correct",

                points:
                    CONFIG.score.treatment,

                stability:
                    0,

                message:
                    "Conduta reconhecida como uma intervenção relacionada à condição clínica."

            };

        }


        /*
         * CSI continua sendo útil para reconhecer
         * ações clínicas genéricas mesmo quando a KB
         * ainda não possui a intervenção estruturada.
         */

        return {

            kind:
                "neutral",

            points:
                CONFIG.score.irrelevant,

            stability:
                -1,

            message:
                "Conduta registrada, mas não foi possível vinculá-la às intervenções disponíveis na Knowledge Base."

        };

    }


    evaluateSupport() {

        return {

            kind:
                "support",

            points:
                CONFIG.score.support,

            stability:
                0,

            message:
                "Medida de suporte registrada."

        };

    }


    evaluateDisposition(
        input,
        state
    ) {

        if (
            normalize(input).includes("alta") &&
            state.stability < 70
        ) {

            return {

                kind:
                    "danger",

                points:
                    CONFIG.score.redFlag,

                stability:
                    -20,

                message:
                    "A disposição proposta é incompatível com a estabilidade atual do paciente."

            };

        }


        return {

            kind:
                "neutral",

            points:
                0,

            stability:
                0,

            message:
                "Disposição registrada. A adequação final depende do estado clínico."

        };

    }

}


/* ============================================================
   CONSEQUENCE ENGINE
   ============================================================ */

class ConsequenceEngine {

    constructor(model, possibilityEngine) {

        this.evaluator =
            new ClinicalEvaluator(
                model,
                possibilityEngine
            );

    }


    apply(
        intent,
        state
    ) {

        let result;


        switch (intent.type) {

            case "exam":

                result =
                    this.evaluator.evaluateExam(
                        intent.term,
                        state
                    );

                break;


            case "diagnosis":

                result =
                    this.evaluator.evaluateDiagnosis(
                        intent.term,
                        state
                    );

                if (
                    result.kind ===
                    "correct"
                ) {

                    state.diagnosisEstablished =
                        true;

                }

                break;


            case "treatment":

                result =
                    this.evaluator.evaluateTreatment(
                        intent.term,
                        state
                    );

                if (
                    result.kind ===
                    "correct"
                ) {

                    state.treatmentPerformed =
                        true;

                }

                break;


            case "support":

                result =
                    this.evaluator.evaluateSupport();

                break;


            case "disposition":

                result =
                    this.evaluator.evaluateDisposition(
                        intent.term,
                        state
                    );

                break;


            default:

                result = {

                    kind:
                        "neutral",

                    points:
                        0,

                    stability:
                        0,

                    message:
                        "Não consegui identificar uma ação clínica reconhecida."

                };

        }


        state.changeStability(
            result.stability
        );


        state.record({

            intent,
            result

        });


        return result;

    }

}


/* ============================================================
   AUXILIAR — DESCRIÇÃO
   ============================================================ */

function describeClinicalObject(object) {

    if (!object) {
        return "achado clínico";
    }


    if (typeof object === "string") {
        return object;
    }


    if (object.entity) {

        return (
            object.entity.name ||
            object.entity.label ||
            object.entity.canonical_name ||
            object.entity.id ||
            "achado clínico"
        );

    }


    if (object.source) {

        return describeClinicalObject(
            object.source
        );

    }


    if (object.name) {
        return object.name;
    }

    if (object.label) {
        return object.label;
    }

    if (object.id) {
        return object.id;
    }


    /*
     * Para padrões estruturados, evitamos despejar
     * o JSON inteiro na interface.
     */

    if (
        object.finding ||
        object.description ||
        object.pattern
    ) {

        return (
            object.finding ||
            object.description ||
            object.pattern
        );

    }


    return "novo achado clínico";

}


/* ============================================================
   CASE VIEW
   ============================================================

   O paciente contém a doença real.

   A interface NÃO recebe a doença.

   Ela recebe somente uma projeção inicial do paciente.
   ============================================================ */

function buildAdmission(patient) {

    const age =
        patient.demographics?.age ??
        "idade não especificada";

    const sex =
        patient.demographics?.sex === "female"
            ? "feminino"
            : "masculino";

    const severity =
        patient.severity || null;


    const presentation =
        Array.isArray(patient.presentation)
            ? patient.presentation
            : [];


    const findings =
        presentation
            .map(
                item =>
                    describeClinicalObject(item)
            )
            .filter(Boolean);


    let text =
        `Paciente ${age} anos, sexo ${sex}.`;


    if (severity) {

        text +=
            ` Estado clínico inicialmente classificado como ${translateSeverity(severity)}.`;

    }


    if (findings.length) {

        text +=
            ` Apresenta ${joinNatural(findings)}.`;

    } else {

        text +=
            " Apresentação clínica inicial ainda pouco caracterizada.";

    }


    text +=
        " Avalie o paciente e conduza a investigação conforme o quadro apresentado.";


    return text;

}


function translateSeverity(value) {

    const map = {

        mild: "leve",

        moderate:
            "moderado",

        severe:
            "grave"

    };


    return map[value] || value;

}


function joinNatural(items) {

    if (!items.length) {
        return "";
    }

    if (items.length === 1) {
        return items[0];
    }

    if (items.length === 2) {
        return `${items[0]} e ${items[1]}`;
    }

    return (
        items
            .slice(0, -1)
            .join(", ") +
        " e " +
        items[items.length - 1]
    );

}


/* ============================================================
   DIAGNOSIS ENGINE
   ============================================================ */

class DiagnosisEngine {

    constructor() {

        this.room =
            this.getRoom();

        this.knowledgeBases =
            [];

        this.models =
            [];

        this.possibilityEngines =
            [];

        this.patientGenerator =
            null;

        this.model =
            null;

        this.possibilityEngine =
            null;

        this.patient =
            null;

        this.state =
            null;

        this.score =
            0;

        this.intentEngine =
            new IntentEngine();

        this.resolver =
            new ActionResolver();

        this.clinicalContext = {

            setting:
                "emergency",

            status:
                "active"

        };

        this.bindUI();

    }


    getRoom() {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const requested =
            params.get("sala") ||
            "vermelha";


        return (
            ARQUIVOS_POR_SALA[requested]
                ? requested
                : "vermelha"
        );

    }


    bindUI() {

        document
            .getElementById("sendBtn")
            ?.addEventListener(
                "click",
                () =>
                    this.processAction()
            );


        document
            .getElementById("actionInput")
            ?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        this.processAction();

                    }

                }
            );


        document
            .getElementById("hintBtn")
            ?.addEventListener(
                "click",
                () =>
                    this.requestHint()
            );


        document
            .getElementById("scienceBtn")
            ?.addEventListener(
                "click",
                () =>
                    this.scientificBase()
            );


        document
            .getElementById("nextBtn")
            ?.addEventListener(
                "click",
                () =>
                    this.loadNewCase()
            );


        document
            .getElementById("backBtn")
            ?.addEventListener(
                "click",
                () =>
                    window.location.href =
                        "index.html"
            );

    }


    async init() {

        this.setText(
            "roomLabel",
            this.room === "vermelha"
                ? "Sala Vermelha"
                : "Clínica Médica"
        );


        this.log(
            "system",
            "DIAGNOSIS",
            "Inicializando motor clínico procedural..."
        );


        await this.loadKnowledgeBase();


        this.buildClinicalEngines();


        await this.loadNewCase();

    }


    /* ========================================================
       KNOWLEDGE BASE
       ======================================================== */

    async loadKnowledgeBase() {

        const files =
            ARQUIVOS_POR_SALA[
                this.room
            ];


        this.knowledgeBases =
            [];


        for (const file of files) {

            try {

                const loaded =
                    await KnowledgeBaseLoader
                        .load(file);


                console.log(
                    "Diagnosis KB:",
                    loaded
                );


                if (
                    loaded.type ===
                    "knowledge_base" &&
                    loaded.valid
                ) {

                    this.knowledgeBases.push({

                        file,

                        data:
                            loaded.data

                    });


                    this.log(
                        "system",
                        "KB",
                        `${file} reconhecida como Knowledge Base estruturada.`
                    );

                }

                else if (
                    loaded.type ===
                    "legacy"
                ) {

                    console.warn(
                        `Diagnosis: ${file} ainda está no formato legado e não participa da geração procedural.`
                    );

                }

                else {

                    console.warn(
                        `Diagnosis: ${file} possui estrutura não reconhecida.`,
                        loaded.errors
                    );

                }


            } catch (error) {

                console.warn(
                    `Diagnosis: falha ao carregar ${file}`,
                    error
                );

            }

        }


        if (
            !this.knowledgeBases.length
        ) {

            throw new Error(
                "Nenhuma Knowledge Base estruturada foi encontrada. Verifique os JSONs e os caminhos dos arquivos."
            );

        }

    }


    /* ========================================================
       CONSTRUÇÃO DOS MOTORES
       ======================================================== */

    buildClinicalEngines() {

        this.models =
            [];

        this.possibilityEngines =
            [];


        for (
            const item
            of this.knowledgeBases
        ) {

            const model =
                new ClinicalModel(
                    item.data
                );


            const possibilityEngine =
                new PossibilityEngine(
                    model
                );


            this.models.push(
                model
            );


            this.possibilityEngines.push(
                possibilityEngine
            );

        }


        /*
         * Por enquanto usamos um modelo unificado para
         * a geração da instância atual.
         *
         * O próximo refinamento pode transformar isso em
         * um Clinical Registry global.
         */

        this.model =
            this.models[0];


        this.possibilityEngine =
            this.possibilityEngines[0];


        /*
         * O PatientGenerator trabalha sobre o modelo
         * atual. Para não perder os outros domínios,
         * criamos um gerador por modelo.
         */

        this.patientGenerators =
            this.possibilityEngines.map(
                engine =>
                    new PatientGenerator(
                        engine
                    )
            );


        this.log(
            "system",
            "CLINICAL MODEL",
            `${this.models.length} modelo(s) clínico(s) construído(s).`
        );


        for (
            let i = 0;
            i < this.models.length;
            i++
        ) {

            const summary =
                this.possibilityEngines[i]
                    .summary();


            console.log(
                "Diagnosis Clinical Model:",
                summary
            );

        }

    }


    /* ========================================================
       PACIENTE PROCEDURAL
       ======================================================== */

    generatePatient() {

        if (
            !this.patientGenerators ||
            !this.patientGenerators.length
        ) {

            throw new Error(
                "PatientGenerator não foi inicializado."
            );

        }


        /*
         * Escolhemos aleatoriamente um domínio clínico
         * que tenha doenças utilizáveis.
         */

        const available =
            this.patientGenerators
                .map(
                    (generator, index) => ({

                        generator,

                        index,

                        diseases:
                            generator.engine
                                .getDiseaseEntities()

                    })
                )
                .filter(
                    item =>
                        item.diseases.length > 0
                );


        if (!available.length) {

            throw new Error(
                "Nenhuma doença disponível nas Knowledge Bases estruturadas."
            );

        }


        const selected =
            available[
                Math.floor(
                    Math.random() *
                    available.length
                )
            ];


        this.model =
            selected.generator.model;


        this.possibilityEngine =
            selected.generator.engine;


        this.patientGenerator =
            selected.generator;


        return this.patientGenerator.generate();

    }


    /* ========================================================
       NOVO CASO
       ======================================================== */

    async loadNewCase() {

        const patient =
            this.generatePatient();


        this.patient =
            patient;


        this.state =
            new PatientState(
                patient,
                this.model,
                this.possibilityEngine
            );


        this.score =
            0;


        this.clinicalContext = {

            setting:
                "emergency",

            status:
                "active"

        };


        /*
         * A doença permanece PRIVADA no objeto patient.
         *
         * A interface recebe somente a apresentação.
         */

        const admission =
            buildAdmission(
                patient
            );


        this.state.initialAdmission =
            admission;


        this.setText(
            "caseTitle",
            "Novo paciente"
        );


        this.setText(
            "caseIntro",
            admission
        );


        this.setText(
            "difficultyLabel",
            translateSeverity(
                patient.severity
            )
        );


        const log =
            document.getElementById(
                "clinicalLog"
            );


        if (log) {
            log.innerHTML = "";
        }


        this.setInput("");


        this.log(
            "system",
            "NOVO CASO",
            "Paciente gerado proceduralmente a partir da Knowledge Base."
        );


        this.log(
            "system",
            "SITUAÇÃO INICIAL",
            "A doença não é revelada. Investigue, formule hipóteses e conduza o paciente."
        );


        this.render();

    }


    /* ========================================================
       AÇÃO PRINCIPAL
       ======================================================== */

    processAction() {

        if (
            !this.state ||
            this.state.completed
        ) {

            return;

        }


        const input =
            document
                .getElementById(
                    "actionInput"
                )
                ?.value
                .trim();


        if (!input) {
            return;
        }


        this.setInput("");


        this.log(
            "player",
            "VOCÊ",
            input
        );


        /*
         * PRIMEIRA CAMADA:
         * intenção/meta-comando.
         */

        const meta =
            this.intentEngine
                .interpret(input);


        if (
            meta.type ===
            "REQUEST_SCORE"
        ) {

            this.showScore();
            return;

        }


        if (
            meta.type ===
            "REQUEST_FOLLOW_UP"
        ) {

            this.handleFollowUp();
            return;

        }


        if (
            meta.type ===
            "REQUEST_INFORMATION"
        ) {

            this.showCurrentInformation();
            return;

        }


        if (
            meta.type ===
            "REQUEST_HINT"
        ) {

            this.requestHint();
            return;

        }


        if (
            meta.type ===
            "REQUEST_FINISH"
        ) {

            this.finishCase();
            return;

        }


        /*
         * SEGUNDA CAMADA:
         * ação clínica.
         */

        const intents =
            this.resolver.resolve(
                input,
                this.state
            );


        for (
            const intent
            of intents
        ) {

            this.state.advanceTime(
                intent.type
            );


            const consequence =
                new ConsequenceEngine(
                    this.model,
                    this.possibilityEngine
                );


            const result =
                consequence.apply(
                    intent,
                    this.state
                );


            this.score +=
                result.points;


            let messageType =
                "system";


            if (
                result.kind ===
                "correct"
            ) {

                messageType =
                    "success";

            }


            if (
                result.kind ===
                "wrong"
            ) {

                messageType =
                    "warn";

            }


            if (
                result.kind ===
                "danger"
            ) {

                messageType =
                    "danger";

                this.state.criticalErrors++;

            }


            this.log(
                messageType,
                this.intentLabel(
                    intent.type
                ),
                result.message
            );

        }


        /*
         * Estado crítico.
         */

        if (
            this.state.stability <= 0
        ) {

            this.finishCase(
                true
            );

            return;

        }


        this.render();

    }


    /* ========================================================
       INFORMAÇÕES
       ======================================================== */

    showCurrentInformation() {

        if (!this.state) {
            return;
        }


        const findings =
            this.state.revealedFindings
                .map(
                    item =>
                        describeClinicalObject(
                            item
                        )
                );


        let message =

            `Estabilidade: ${this.state.stability}%.\n` +

            `Tempo: ${this.state.time} min.\n`;


        if (findings.length) {

            message +=
                `Achados disponíveis: ${joinNatural(findings)}.`;

        } else {

            message +=
                "Nenhum achado adicional foi revelado.";

        }


        this.log(
            "system",
            "INFORMAÇÕES DISPONÍVEIS",
            message
        );

    }


    /* ========================================================
       SEGUIMENTO
       ======================================================== */

    handleFollowUp() {

        if (
            !this.state
        ) {
            return;
        }


        if (
            !this.state.diagnosisEstablished
        ) {

            this.log(
                "system",
                "SEGUIMENTO",
                "O paciente ainda está em investigação. Antes do seguimento definitivo, é necessário estabelecer melhor o problema clínico."
            );

            return;

        }


        if (
            !this.state.treatmentPerformed
        ) {

            this.log(
                "system",
                "SEGUIMENTO",
                "O diagnóstico foi reconhecido, mas a etapa terapêutica ainda não foi estabelecida."
            );

            return;

        }


        this.clinicalContext.setting =
            "followup";


        const disease =
            this.model.getEntity(
                this.patient.condition.id
            );


        const evolution =
            this.possibilityEngine
                .getEvolution(
                    disease?.id
                );


        if (evolution) {

            this.log(
                "system",
                "SEGUIMENTO",
                describeClinicalObject(
                    evolution
                )
            );

        } else {

            this.log(
                "system",
                "SEGUIMENTO",
                "A Knowledge Base atual não possui informações estruturadas suficientes para determinar o seguimento específico deste paciente."
            );

        }


        this.render();

    }


    /* ========================================================
       SCORE
       ======================================================== */

    showScore() {

        if (!this.state) {
            return;
        }


        this.log(
            "system",
            "AVALIAÇÃO ATUAL",

            `Pontuação: ${this.score} pontos.
Tempo: ${this.state.time} min.
Estabilidade: ${this.state.stability}%.
Achados revelados: ${this.state.revealedFindings.length}.
Erros críticos: ${this.state.criticalErrors}.`

        );

    }


    /* ========================================================
       DICA
       ======================================================== */

    requestHint() {

        if (!this.state) {
            return;
        }


        this.state.helpUsed++;

        this.score +=
            CONFIG.score.hint;


        let hint;


        if (
            !this.state.revealedFindings.length
        ) {

            hint =
                "Comece pela investigação que mais pode reduzir a incerteza diante da apresentação.";

        }

        else if (
            !this.state.diagnosisEstablished
        ) {

            hint =
                "Use os achados disponíveis para construir uma hipótese diagnóstica explícita.";

        }

        else if (
            !this.state.treatmentPerformed
        ) {

            hint =
                "Com a hipótese definida, procure uma intervenção compatível com a condição clínica.";

        }

        else {

            hint =
                "Revise estabilidade, evolução e disposição.";

        }


        this.log(
            "warn",
            "DICA",
            `${hint} (${CONFIG.score.hint} pontos)`
        );


        this.render();

    }


    /* ========================================================
       BASE CIENTÍFICA
       ======================================================== */

    scientificBase() {

        if (!this.patient) {
            return;
        }


        const disease =
            this.model.getEntity(
                this.patient.condition.id
            );


        const pathophysiology =
            this.possibilityEngine
                .getPathophysiology(
                    disease?.id
                );


        /*
         * A base científica pode mostrar a doença aqui,
         * porque o botão é um modo de estudo e não a
         * apresentação inicial do paciente.
         */

        const text = [

            `Condição clínica: ${
                disease?.name ||
                disease?.label ||
                disease?.id ||
                "não identificada"
            }`,

            "",

            pathophysiology
                ? `Fisiopatologia:\n${describeClinicalObject(pathophysiology)}`
                : "Fisiopatologia não estruturada.",

            "",

            `Knowledge Base: ${
                this.model.schemaVersion ||
                "versão não informada"
            }`

        ].join("\n");


        alert(text);

    }


    /* ========================================================
       ENCERRAMENTO
       ======================================================== */

    finishCase(forced = false) {

        if (
            !this.state ||
            this.state.completed
        ) {

            return;

        }


        this.state.completed =
            true;


        this.clinicalContext.status =
            "completed";


        const disease =
            this.model.getEntity(
                this.patient.condition.id
            );


        this.log(
            this.state.stability > 0
                ? "success"
                : "danger",

            "CASO ENCERRADO",

            `Pontuação: ${this.score} pts | Tempo: ${this.state.time} min | Estabilidade: ${this.state.stability}%`
        );


        /*
         * Somente agora, depois do caso encerrado,
         * podemos revelar a condição geradora.
         */

        this.log(
            "system",
            "DEBRIEFING",
            `Condição clínica geradora: ${
                disease?.name ||
                disease?.label ||
                disease?.id ||
                "não identificada"
            }.`
        );


        const pathophysiology =
            this.possibilityEngine
                .getPathophysiology(
                    disease?.id
                );


        if (pathophysiology) {

            this.log(
                "system",
                "FISIOPATOLOGIA",
                describeClinicalObject(
                    pathophysiology
                )
            );

        }


        if (
            forced
        ) {

            this.log(
                "danger",
                "RESULTADO",
                "O estado clínico atingiu estabilidade zero antes do encerramento."
            );

        }


        this.render();

    }


    /* ========================================================
       LABELS
       ======================================================== */

    intentLabel(type) {

        const labels = {

            exam:
                "INVESTIGAÇÃO",

            diagnosis:
                "DIAGNÓSTICO",

            treatment:
                "CONDUTA",

            support:
                "SUPORTE",

            disposition:
                "DISPOSIÇÃO",

            unknown:
                "INTERPRETAÇÃO"

        };


        return (
            labels[type] ||
            "AÇÃO"
        );

    }


    /* ========================================================
       RENDER
       ======================================================== */

    render() {

        if (!this.state) {
            return;
        }


        this.setText(
            "score",
            this.score
        );


        this.setText(
            "stabilityText",
            `${this.state.stability}%`
        );


        const stabilityBar =
            document.getElementById(
                "stabilityBar"
            );


        if (stabilityBar) {

            stabilityBar.style.width =
                `${this.state.stability}%`;

        }


        this.setText(
            "timeText",
            `${this.state.time} min`
        );


        this.setText(
            "fc",
            this.state.vitals.fc
        );


        this.setText(
            "spo2",
            this.state.vitals.spo2
        );


        this.setText(
            "pa",
            this.state.vitals.pa
        );


        this.setText(
            "glucose",
            this.state.vitals.glucose
        );


        const list =
            document.getElementById(
                "stateList"
            );


        if (!list) {
            return;
        }


        list.innerHTML =
            "";


        const states = [

            `Contexto: ${
                this.clinicalContext.setting
            }`,

            `Achados revelados: ${
                this.state.revealedFindings.length
            }`,

            `Ações executadas: ${
                this.state.actions.length
            }`,

            `Diagnóstico estabelecido: ${
                this.state.diagnosisEstablished
                    ? "sim"
                    : "não"
            }`,

            `Tratamento reconhecido: ${
                this.state.treatmentPerformed
                    ? "sim"
                    : "não"
            }`,

            `Erros críticos: ${
                this.state.criticalErrors
            }`,

            `Dicas utilizadas: ${
                this.state.helpUsed
            }`

        ];


        for (const item of states) {

            const li =
                document.createElement(
                    "li"
                );

            li.textContent =
                item;

            list.appendChild(
                li
            );

        }

    }


    /* ========================================================
       LOG
       ======================================================== */

    log(
        type,
        author,
        message
    ) {

        const container =
            document.getElementById(
                "clinicalLog"
            );


        if (!container) {
            return;
        }


        const element =
            document.createElement(
                "div"
            );


        element.className =
            `msg ${type}`;


        const title =
            document.createElement(
                "strong"
            );


        title.textContent =
            author;


        const body =
            document.createElement(
                "div"
            );


        body.textContent =
            message;


        element.appendChild(
            title
        );


        element.appendChild(
            body
        );


        container.appendChild(
            element
        );


        container.scrollTop =
            container.scrollHeight;

    }


    /* ========================================================
       DOM
       ======================================================== */

    setText(id, value) {

        const element =
            document.getElementById(
                id
            );


        if (element) {

            element.textContent =
                value;

        }

    }


    setInput(value) {

        const input =
            document.getElementById(
                "actionInput"
            );


        if (input) {

            input.value =
                value;

        }

    }

}


/* ============================================================
   BOOT
   ============================================================ */

let diagnosisEngine = null;


window.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            diagnosisEngine =
                new DiagnosisEngine();


            window.idmtEngine =
                diagnosisEngine;


            await diagnosisEngine.init();

        } catch (error) {

            console.error(
                "Diagnosis Engine Error:",
                error
            );


            const log =
                document.getElementById(
                    "clinicalLog"
                );


            if (log) {

                log.innerHTML =
                    "";


                const message =
                    document.createElement(
                        "div"
                    );


                message.className =
                    "msg danger";


                message.textContent =
                    `Falha ao iniciar o Diagnosis: ${error.message}`;


                log.appendChild(
                    message
                );

            }

        }

    }
);
