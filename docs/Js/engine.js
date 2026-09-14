"use strict";

/* ============================================================
   DIAGNOSIS ENGINE V3
   Knowledge Base
        ↓
   Knowledge Adapter
        ↓
   Case Generator
        ↓
   Patient State
        ↓
   Intent Engine
        ↓
   Action Resolver / CSI
        ↓
   Consequence Engine
        ↓
   Evaluation

   V3:
   - adiciona camada de intenção/meta-comandos
   - separa comandos do jogo de ações clínicas
   - prepara arquitetura para Episode Manager
   ============================================================ */


/* ============================================================
   CONFIGURAÇÃO
   ============================================================ */

const ARQUIVOS_POR_SALA = {

    vermelha: [
        "knowledge_base/neurologia.json",
        "knowledge_base/nefrologia.json",
        "knowledge_base/reumatologia.json",
        "knowledge_base/endocrinologia.json",
        "knowledge_base/cardiopatias.json"
    ],

    clinica: [
        "knowledge_base/neurologia.json",
        "knowledge_base/nefrologia.json",
        "knowledge_base/reumatologia.json",
        "knowledge_base/endocrinologia.json",
        "knowledge_base/cardiopatias.json"
    ]

};


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
        "com",
        "sem",
        "me",
        "se",
        "ao",
        "aos",
        "peco",
        "solicito",
        "solicitar",
        "pedir",
        "fazer",
        "realizar",
        "avaliar"

    ]);


    return normalize(text)
        .split(" ")
        .filter(Boolean)
        .filter(token =>
            !stopWords.has(token)
        );

}


function similarity(a, b) {

    const A =
        new Set(tokens(a));

    const B =
        new Set(tokens(b));


    if (
        !A.size ||
        !B.size
    ) {

        return 0;

    }


    let intersection = 0;


    for (
        const token
        of A
    ) {

        if (
            B.has(token)
        ) {

            intersection++;

        }

    }


    return intersection /
        Math.max(
            A.size,
            B.size
        );

}


function containsPhrase(
    input,
    list
) {

    const text =
        normalize(input);


    return (list || [])
        .some(item => {

            const target =
                normalize(item);


            if (!target) {
                return false;
            }


            return (
                text.includes(target) ||
                target.includes(text)
            );

        });

}


function clone(value) {

    try {

        return JSON.parse(
            JSON.stringify(value)
        );

    } catch {

        return value;

    }

}


function getArray(
    object,
    keys
) {

    for (
        const key
        of keys
    ) {

        if (
            Array.isArray(
                object?.[key]
            )
        ) {

            return object[key];

        }

    }


    return [];

}


/* ============================================================
   CSI
   Classificação Semiótica / Semântica de Intenção

   IMPORTANTE:
   Isso NÃO é o cérebro clínico.

   É somente a camada que transforma linguagem humana
   em intenção clínica estruturada.
   ============================================================ */

const CSI = {

    exam: {

        ecg: [
            "ecg",
            "eletro",
            "eletrocardiograma",
            "traçado"
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
            "funcao renal"
        ],

        glucose: [
            "glicemia",
            "glicose",
            "dextro",
            "hgt"
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
            "sf 0.9"
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
   ============================================================

   NOVA CAMADA V3.

   Antes de perguntar:

       "O que o jogador fez clinicamente?"

   perguntamos:

       "O jogador está fazendo uma ação clínica
        ou está conversando com o próprio jogo?"

   Exemplos:

       "Qual minha nota?"
       → REQUEST_SCORE

       "Qual o seguimento?"
       → REQUEST_FOLLOW_UP

       "Me mostre os dados"
       → REQUEST_INFORMATION

       "Me dê uma dica"
       → REQUEST_HINT

       "Vou administrar hidrocortisona"
       → CLINICAL_ACTION

   Essa camada NÃO avalia medicina.
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
                "minha avaliação",
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
                "depois disso",
                "qual o proximo passo",
                "qual o próximo passo"

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


    normalize(text) {

        return normalize(text);

    }


    matches(
        text,
        patterns
    ) {

        const normalized =
            this.normalize(text);


        return patterns.some(
            pattern =>
                normalized.includes(
                    this.normalize(pattern)
                )
        );

    }


    interpret(text) {

        const normalized =
            this.normalize(text);


        if (!normalized) {

            return {

                type:
                    "UNKNOWN",

                confidence:
                    0

            };

        }


        /*
         * A ordem é deliberada.
         *
         * Primeiro comandos explícitos do jogo.
         * Só depois deixamos a frase chegar
         * ao interpretador clínico.
         */


        if (
            this.matches(
                normalized,
                this.patterns.request_score
            )
        ) {

            return {

                type:
                    "REQUEST_SCORE",

                confidence:
                    1

            };

        }


        if (
            this.matches(
                normalized,
                this.patterns.request_follow_up
            )
        ) {

            return {

                type:
                    "REQUEST_FOLLOW_UP",

                confidence:
                    1

            };

        }


        if (
            this.matches(
                normalized,
                this.patterns.request_information
            )
        ) {

            return {

                type:
                    "REQUEST_INFORMATION",

                confidence:
                    0.95

            };

        }


        if (
            this.matches(
                normalized,
                this.patterns.request_hint
            )
        ) {

            return {

                type:
                    "REQUEST_HINT",

                confidence:
                    1

            };

        }


        if (
            this.matches(
                normalized,
                this.patterns.request_finish
            )
        ) {

            return {

                type:
                    "REQUEST_FINISH",

                confidence:
                    1

            };

        }


        /*
         * Não é comando de interface.
         *
         * Entregamos ao cérebro clínico.
         */

        return {

            type:
                "CLINICAL_ACTION",

            confidence:
                0.7

        };

    }

}


/* ============================================================
   KNOWLEDGE ADAPTER
   ============================================================ */

class KnowledgeAdapter {

    static adaptFile(
        json,
        source
    ) {

        let cases = [];


        if (
            Array.isArray(json)
        ) {

            cases =
                json;

        } else if (
            Array.isArray(json?.casos)
        ) {

            cases =
                json.casos;

        } else if (
            Array.isArray(json?.conhecimento)
        ) {

            cases =
                json.conhecimento;

        } else if (
            json &&
            typeof json === "object"
        ) {

            cases =
                [json];

        }


        return cases
            .map(
                (item, index) =>
                    this.adaptCase(
                        item,
                        source,
                        index
                    )
            )
            .filter(Boolean);

    }


    static adaptCase(
        item,
        source,
        index
    ) {

        if (
            !item ||
            typeof item !== "object"
        ) {

            return null;

        }


        const investigation =
            item.fase_1_investigacao ||
            {};


        const diagnosis =
            item.fase_2_diagnostico ||
            {};


        const treatment =
            item.fase_3_conduta ||
            {};


        const discussion =
            item.discussao_clinica_final ||
            {};


        return {

            id:
                item.id_caso ||
                item.id ||
                `${source}_${index}`,

            source,

            pathology:
                item.patologia_alvo ||
                item.diagnostico_alvo ||
                item.entidade_clinica ||
                item.diagnostico ||
                "Condição clínica não identificada",

            difficulty:
                item.dificuldade ||
                item.nivel ||
                "Não especificada",

            admission:
                item.vinheta_admissao ||
                item.apresentacao_inicial ||
                item.apresentacao ||
                item.enunciado ||
                item.descricao ||
                "",

            knowledge: {

                investigation: {

                    expected:
                        getArray(
                            investigation,
                            [
                                "gabarito_esperado",
                                "respostas_aceitas",
                                "exames_esperados",
                                "acoes_esperadas"
                            ]
                        ),

                    success:
                        investigation.achado_sucesso ||
                        investigation.resultado_sucesso ||
                        "",

                    error:
                        investigation.resposta_preceptor_erro ||
                        ""

                },


                diagnosis: {

                    expected:
                        getArray(
                            diagnosis,
                            [
                                "gabarito_esperado",
                                "respostas_aceitas",
                                "diagnosticos_aceitos"
                            ]
                        ),

                    distractors:
                        getArray(
                            diagnosis,
                            [
                                "distratores",
                                "diagnosticos_distratores",
                                "respostas_erradas"
                            ]
                        ),

                    success:
                        diagnosis.resposta_sucesso ||
                        diagnosis.feedback_sucesso ||
                        "",

                    error:
                        diagnosis.feedback_erro ||
                        diagnosis.resposta_preceptor_erro ||
                        ""

                },


                treatment: {

                    expected:
                        getArray(
                            treatment,
                            [
                                "gabarito_esperado",
                                "respostas_aceitas",
                                "condutas_esperadas",
                                "tratamentos_esperados"
                            ]
                        ),

                    redFlags:
                        getArray(
                            treatment,
                            [
                                "red_flags",
                                "redflags",
                                "sinais_de_perigo",
                                "condutas_perigosas"
                            ]
                        ),

                    success:
                        treatment.resposta_sucesso ||
                        treatment.feedback_sucesso ||
                        "",

                    error:
                        treatment.feedback_erro ||
                        ""

                },


                discussion: {

                    takeaway:
                        discussion.takeaway ||
                        discussion.mensagem_chave ||
                        "",

                    pathophysiology:
                        discussion.fisiopatologia ||
                        discussion.explicacao ||
                        ""

                }

            },

            structured:
                item.estrutura_clinica ||
                item.structured ||
                item.clinical_model ||
                null

        };

    }

}


/* ============================================================
   CASE GENERATOR
   ============================================================ */

class CaseGenerator {

    constructor(pool) {

        this.pool =
            pool;

    }


    generate(room) {

        if (
            !this.pool.length
        ) {

            throw new Error(
                "Nenhum conhecimento clínico disponível."
            );

        }


        const source =
            this.pool[
                Math.floor(
                    Math.random() *
                    this.pool.length
                )
            ];


        return {

            instanceId:
                `${source.id}_${Date.now()}_${Math.random()
                    .toString(16)
                    .slice(2)}`,

            room,

            sourceId:
                source.id,

            pathology:
                source.pathology,

            difficulty:
                source.difficulty,

            admission:
                source.admission,

            knowledge:
                clone(source.knowledge),

            structured:
                clone(source.structured),

            source

        };

    }

}


/* ============================================================
   PATIENT STATE
   ============================================================ */

class PatientState {

    constructor(caseInstance) {

        this.case =
            caseInstance;

        this.stability =
            100;

        this.time =
            0;

        this.actions =
            [];

        this.findings =
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

        this.vitals =
            this.extractVitals(
                caseInstance.admission
            );

    }


    extractVitals(text) {

        const fc =
            text.match(
                /\bFC\s*[:=]?\s*(\d{2,3})/i
            );


        const spo2 =
            text.match(
                /\b(?:SpO2|Sat(?:uração)?|saturação)\s*[:=]?\s*(\d{2,3})/i
            );


        const pa =
            text.match(
                /\bPA\s*[:=]?\s*(\d{2,3})\s*[xX\/]\s*(\d{2,3})/i
            );


        const glucose =
            text.match(
                /\b(?:glicemia|glicose)\s*[:=]?\s*(\d{2,3})/i
            );


        return {

            fc:
                fc
                    ? `${fc[1]} bpm`
                    : "—",

            spo2:
                spo2
                    ? `${spo2[1]}%`
                    : "—",

            pa:
                pa
                    ? `${pa[1]}/${pa[2]} mmHg`
                    : "—",

            glucose:
                glucose
                    ? `${glucose[1]} mg/dL`
                    : "—"

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


        if (
            this.findings.includes(
                finding
            )
        ) {

            return false;

        }


        this.findings.push(
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
   ACTION RESOLVER
   ============================================================ */

class ActionResolver {

    resolve(
        text,
        state
    ) {

        const normalized =
            normalize(text);


        const intents =
            [];


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
                            this.mapType(
                                group
                            ),

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
         * Caso não seja claramente um exame,
         * suporte ou tratamento, tentamos interpretar
         * como declaração diagnóstica.
         */

        if (
            this.looksLikeDiagnosis(
                text,
                state
            )
        ) {

            intents.push({

                type:
                    "diagnosis",

                concept:
                    "diagnosis_statement",

                term:
                    text,

                confidence:
                    similarity(
                        text,
                        state.case.pathology
                    )

            });

        }


        if (
            !intents.length
        ) {

            return [{

                type:
                    "unknown",

                concept:
                    "unknown",

                term:
                    text,

                confidence:
                    0

            }];

        }


        /*
         * Remove duplicações.
         */

        const unique = [];

        const seen =
            new Set();


        for (
            const intent
            of intents
        ) {

            const key =
                `${intent.type}:${intent.concept}`;


            if (
                !seen.has(key)
            ) {

                seen.add(key);

                unique.push(
                    intent
                );

            }

        }


        return unique;

    }


    mapType(group) {

        if (
            group === "exam"
        ) {

            return "exam";

        }


        if (
            group === "treatment"
        ) {

            return "treatment";

        }


        if (
            group === "support"
        ) {

            return "support";

        }


        if (
            group === "disposition"
        ) {

            return "disposition";

        }


        return "unknown";

    }


    looksLikeDiagnosis(
        text,
        state
    ) {

        const t =
            normalize(text);


        const diagnosticExpressions = [

            "diagnostico",
            "hipotese",
            "suspeito",
            "compativel",
            "trata-se de",
            "provavelmente",
            "considero"

        ];


        if (
            diagnosticExpressions.some(
                expression =>
                    t.includes(
                        normalize(expression)
                    )
            )
        ) {

            return true;

        }


        /*
         * ATENÇÃO:
         *
         * Esta heurística continua existindo para
         * compatibilidade com a V2.
         *
         * Porém, agora frases reconhecidas como
         * meta-comandos nunca chegam aqui.
         */

        return (
            t.length >= 8 &&
            !this.containsKnownAction(
                text
            )
        );

    }


    containsKnownAction(
        text
    ) {

        const normalized =
            normalize(text);


        for (
            const group
            of Object.values(CSI)
        ) {

            for (
                const synonyms
                of Object.values(group)
            ) {

                for (
                    const synonym
                    of synonyms
                ) {

                    if (
                        normalized.includes(
                            normalize(synonym)
                        )
                    ) {

                        return true;

                    }

                }

            }

        }


        return false;

    }

}


/* ============================================================
   EVALUATION ENGINE
   ============================================================ */

class EvaluationEngine {

    matchAgainst(
        input,
        expected
    ) {

        const normalized =
            normalize(input);


        let best = {

            matched:
                false,

            item:
                null,

            score:
                0

        };


        for (
            const item
            of expected || []
        ) {

            const target =
                normalize(item);


            if (!target) {
                continue;
            }


            if (
                normalized.includes(
                    target
                ) ||
                target.includes(
                    normalized
                )
            ) {

                return {

                    matched:
                        true,

                    item,

                    score:
                        1

                };

            }


            const score =
                similarity(
                    input,
                    item
                );


            if (
                score >
                best.score
            ) {

                best = {

                    matched:
                        score >=
                        CONFIG.similarityThreshold,

                    item,

                    score

                };

            }

        }


        return best;

    }


    evaluateInvestigation(
        input,
        state
    ) {

        const knowledge =
            state.case
                .knowledge
                .investigation;


        const result =
            this.matchAgainst(
                input,
                knowledge.expected
            );


        if (
            result.matched
        ) {

            const newFinding =
                state.addFinding(
                    knowledge.success
                );


            return {

                kind:
                    "correct",

                points:
                    newFinding
                        ? CONFIG.score.investigation
                        : 2,

                stability:
                    0,

                message:
                    newFinding
                        ? (
                            knowledge.success ||
                            "Investigação adequada. Novo achado revelado."
                        )
                        : "Essa investigação já foi realizada."

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
                "Investigação registrada, mas não há consequência configurada para este exame neste caso."

        };

    }


    evaluateDiagnosis(
        input,
        state
    ) {

        const knowledge =
            state.case
                .knowledge
                .diagnosis;


        const correct =
            this.matchAgainst(
                input,
                knowledge.expected
            );


        if (
            correct.matched
        ) {

            return {

                kind:
                    "correct",

                points:
                    CONFIG.score.diagnosis,

                stability:
                    0,

                message:
                    knowledge.success ||
                    `Diagnóstico compatível com ${state.case.pathology}.`

            };

        }


        const distractor =
            this.matchAgainst(
                input,
                knowledge.distractors
            );


        if (
            distractor.matched
        ) {

            return {

                kind:
                    "wrong",

                points:
                    CONFIG.score.wrongDiagnosis,

                stability:
                    -8,

                message:
                    knowledge.error ||
                    "Hipótese diagnóstica inadequada para o estado clínico atual."

            };

        }


        /*
         * Fallback:
         * compara diretamente com a patologia.
         */

        if (
            similarity(
                input,
                state.case.pathology
            ) >= 0.58
        ) {

            return {

                kind:
                    "correct",

                points:
                    CONFIG.score.diagnosis,

                stability:
                    0,

                message:
                    knowledge.success ||
                    `Diagnóstico compatível com ${state.case.pathology}.`

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
                "Hipótese registrada, mas ainda não corresponde ao diagnóstico-alvo configurado."

        };

    }


    evaluateTreatment(
        input,
        state
    ) {

        const knowledge =
            state.case
                .knowledge
                .treatment;


        /*
         * Red flag é avaliada ANTES da resposta correta.
         */

        if (
            containsPhrase(
                input,
                knowledge.redFlags
            )
        ) {

            return {

                kind:
                    "danger",

                points:
                    CONFIG.score.redFlag,

                stability:
                    -25,

                message:
                    knowledge.error ||
                    "Conduta configurada como red flag neste caso. O estado clínico sofreu deterioração."

            };

        }


        const result =
            this.matchAgainst(
                input,
                knowledge.expected
            );


        if (
            result.matched
        ) {

            return {

                kind:
                    "correct",

                points:
                    CONFIG.score.treatment,

                stability:
                    0,

                message:
                    knowledge.success ||
                    "Conduta adequada reconhecida pelo modelo."

            };

        }


        return {

            kind:
                "neutral",

            points:
                CONFIG.score.irrelevant,

            stability:
                -1,

            message:
                "Conduta registrada, mas não corresponde às condutas configuradas para este cenário."

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
                "Medida de suporte registrada no estado do paciente."

        };

    }

}


/* ============================================================
   CONSEQUENCE ENGINE
   ============================================================ */

class ConsequenceEngine {

    constructor() {

        this.evaluator =
            new EvaluationEngine();

    }


    apply(
        intent,
        state
    ) {

        let result;


        switch (
            intent.type
        ) {

            case "exam":

                result =
                    this.evaluator
                        .evaluateInvestigation(
                            intent.term,
                            state
                        );

                break;


            case "diagnosis":

                result =
                    this.evaluator
                        .evaluateDiagnosis(
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
                    this.evaluator
                        .evaluateTreatment(
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
                    this.evaluator
                        .evaluateSupport();

                break;


            case "disposition":

                result = {

                    kind:
                        "neutral",

                    points:
                        0,

                    stability:
                        0,

                    message:
                        "Disposição registrada. A adequação depende do estado clínico e da Knowledge Base."

                };

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
                        "Não consegui identificar uma intenção clínica reconhecida."

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
   ENGINE PRINCIPAL
   ============================================================ */

class DiagnosisEngineV2 {

    constructor() {

        this.room =
            this.getRoom();


        this.pool =
            [];


        this.case =
            null;


        this.state =
            null;


        this.score =
            0;


        /*
         * V3:
         * Intent Engine fica antes do Action Resolver.
         */

        this.intentEngine =
            new IntentEngine();


        this.resolver =
            new ActionResolver();


        this.consequence =
            new ConsequenceEngine();


        /*
         * Preparação para a próxima etapa.
         *
         * Ainda não é o Episode Manager.
         * Apenas mantemos o contexto atual.
         */

        this.clinicalContext = {

            setting:
                "emergency",

            status:
                "active",

            objectives: [
                "stabilize_patient",
                "identify_clinical_problem",
                "treat_acute_threat"
            ]

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


        if (
            ARQUIVOS_POR_SALA[
                requested
            ]
        ) {

            return requested;

        }


        return "vermelha";

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
            "ENGINE",
            "Inicializando Knowledge Loader..."
        );


        await this.loadKnowledgeBase();


        await this.loadNewCase();

    }


    async loadKnowledgeBase() {

        const files =
            ARQUIVOS_POR_SALA[
                this.room
            ];


        const errors =
            [];


        for (
            const file
            of files
        ) {

            try {

                const response =
                    await fetch(
                        file,
                        {
                            cache:
                                "no-store"
                        }
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        `HTTP ${response.status}`
                    );

                }


                const json =
                    await response.json();


                const adapted =
                    KnowledgeAdapter.adaptFile(
                        json,
                        file
                    );


                this.pool.push(
                    ...adapted
                );


            } catch (error) {

                errors.push(
                    `${file}: ${error.message}`
                );

            }

        }


        if (
            !this.pool.length
        ) {

            throw new Error(
                "Nenhuma unidade clínica foi carregada. Verifique os caminhos dos JSONs e se o projeto está sendo servido por HTTP/HTTPS."
            );

        }


        this.log(
            "system",
            "KNOWLEDGE BASE",
            `${this.pool.length} unidade(s) clínicas carregadas.`
        );


        if (
            errors.length
        ) {

            console.warn(
                "Falhas da Knowledge Base:",
                errors
            );

        }

    }


    async loadNewCase() {

        if (
            !this.pool.length
        ) {

            return;

        }


        const generator =
            new CaseGenerator(
                this.pool
            );


        this.case =
            generator.generate(
                this.room
            );


        this.state =
            new PatientState(
                this.case
            );


        this.score =
            0;


        /*
         * Cada novo caso começa novamente
         * no contexto de emergência.
         */

        this.clinicalContext = {

            setting:
                "emergency",

            status:
                "active",

            objectives: [
                "stabilize_patient",
                "identify_clinical_problem",
                "treat_acute_threat"
            ]

        };


        this.setText(
            "caseTitle",
            this.case.pathology
        );


        this.setText(
            "caseIntro",
            this.case.admission ||
            "Sem apresentação inicial."
        );


        this.setText(
            "difficultyLabel",
            this.case.difficulty
        );


        const log =
            document.getElementById(
                "clinicalLog"
            );


        if (log) {

            log.innerHTML =
                "";

        }


        this.setInput("");


        this.log(
            "system",
            "CASO RECEBIDO",
            `Nova instância clínica gerada a partir do conhecimento: ${this.case.pathology}.`
        );


        this.log(
            "system",
            "SITUAÇÃO INICIAL",
            "A partir daqui, suas ações são interpretadas em tempo real. Não existe mais uma sequência fixa de fases."
        );


        this.render();

    }


    /* ========================================================
       PROCESSAMENTO PRINCIPAL

       V3:
       1. Intent Engine
       2. Meta-comando?
       3. Se não, Action Resolver
       4. Consequence Engine
       ======================================================== */

    processAction() {

        if (
            !this.state
        ) {

            return;

        }


        if (
            this.state.completed
        ) {

            this.log(
                "warn",
                "ENGINE",
                "Este caso já foi encerrado."
            );

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
         * =====================================================
         * CAMADA 1 — INTENÇÃO
         * =====================================================
         */

        const metaIntent =
            this.intentEngine
                .interpret(input);


        /*
         * -----------------------------------------------------
         * NOTA / AVALIAÇÃO
         * -----------------------------------------------------
         */

        if (
            metaIntent.type ===
            "REQUEST_SCORE"
        ) {

            this.showScore();

            return;

        }


        /*
         * -----------------------------------------------------
         * SEGUIMENTO
         * -----------------------------------------------------
         */

        if (
            metaIntent.type ===
            "REQUEST_FOLLOW_UP"
        ) {

            this.handleFollowUpQuestion();

            return;

        }


        /*
         * -----------------------------------------------------
         * INFORMAÇÕES DISPONÍVEIS
         * -----------------------------------------------------
         */

        if (
            metaIntent.type ===
            "REQUEST_INFORMATION"
        ) {

            this.showCurrentInformation();

            return;

        }


        /*
         * -----------------------------------------------------
         * DICA
         * -----------------------------------------------------
         */

        if (
            metaIntent.type ===
            "REQUEST_HINT"
        ) {

            this.requestHint();

            return;

        }


        /*
         * -----------------------------------------------------
         * FINALIZAÇÃO
         * -----------------------------------------------------
         *
         * Por enquanto usamos o encerramento antigo.
         *
         * Na próxima camada isso será substituído pelo
         * Episode Manager + fechamento de contexto.
         */

        if (
            metaIntent.type ===
            "REQUEST_FINISH"
        ) {

            this.finishCase();

            return;

        }


        /*
         * =====================================================
         * CAMADA 2 — AÇÃO CLÍNICA
         * =====================================================
         */

        if (
            metaIntent.type !==
            "CLINICAL_ACTION"
        ) {

            return;

        }


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


            const result =
                this.consequence.apply(
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


        if (
            this.state.stability <= 0
        ) {

            this.finishCase(
                true
            );

        }


        this.render();

    }


    /* ========================================================
       META-COMANDOS
       ======================================================== */


    showScore() {

        if (
            !this.state
        ) {

            return;

        }


        const message =

            `Pontuação atual: ${this.score} pontos.\n` +

            `Tempo decorrido: ${this.state.time} min.\n` +

            `Estabilidade: ${this.state.stability}%.\n` +

            `Achados revelados: ${this.state.findings.length}.\n` +

            `Erros críticos: ${this.state.criticalErrors}.`;


        this.log(
            "system",
            "AVALIAÇÃO ATUAL",
            message
        );


        return {

            type:
                "score",

            score:
                this.score

        };

    }


    handleFollowUpQuestion() {

        const context =
            this.clinicalContext?.setting ||
            "emergency";


        let message;


        if (
            context ===
            "emergency"
        ) {

            message =
                "O paciente ainda está no contexto de emergência. O objetivo atual é controlar a ameaça aguda e estabilizar o paciente. O seguimento definitivo será avaliado após o controle do episódio agudo.";

        } else if (
            context ===
            "inpatient"
        ) {

            message =
                "O episódio agudo foi controlado. Agora o foco pode migrar para confirmação diagnóstica, investigação etiológica e tratamento definitivo.";

        } else if (
            context ===
            "outpatient"
        ) {

            message =
                "O paciente está em acompanhamento ambulatorial. O foco agora é tratamento de manutenção, prevenção de recorrência e monitorização.";

        } else {

            message =
                "O próximo passo depende do contexto clínico atual e da evolução do paciente.";

        }


        this.log(
            "system",
            "SEGUIMENTO",
            message
        );


        return {

            type:
                "follow_up",

            context,

            message

        };

    }


    showCurrentInformation() {

        if (
            !this.state
        ) {

            return;

        }


        const findings =
            this.state.findings.length
                ? this.state.findings.join(
                    ", "
                )
                : "Nenhum achado adicional foi revelado ainda.";


        const message =

            `Contexto atual: ${this.clinicalContext.setting}.\n` +

            `Estabilidade: ${this.state.stability}%.\n` +

            `Achados revelados: ${findings}.`;


        this.log(
            "system",
            "INFORMAÇÕES DISPONÍVEIS",
            message
        );


        return {

            type:
                "information",

            findings:
                this.state.findings

        };

    }


    /* ========================================================
       ENCERRAMENTO LEGADO
       ======================================================== */

    isFinishCommand(
        input
    ) {

        const text =
            normalize(input);


        return [

            "finalizar",
            "finalizar caso",
            "encerrar",
            "encerrar caso",
            "terminar caso"

        ].some(
            command =>
                text === command
        );

    }


    finishCase(
        forced = false
    ) {

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


        this.log(
            this.state.stability > 0
                ? "success"
                : "danger",

            "CASO ENCERRADO",

            `Pontuação: ${this.score} pts | Tempo: ${this.state.time} min | Estabilidade: ${this.state.stability}%`

        );


        const discussion =
            this.case
                .knowledge
                .discussion ||
            {};


        const debrief =

            [

                discussion.takeaway
                    ? `Mensagem-chave:\n${discussion.takeaway}`
                    : "",

                discussion.pathophysiology
                    ? `Fisiopatologia:\n${discussion.pathophysiology}`
                    : ""

            ]

            .filter(Boolean)
            .join("\n\n");


        if (
            debrief
        ) {

            this.log(
                "system",
                "DEBRIEFING",
                debrief
            );

        } else if (
            !forced
        ) {

            this.log(
                "system",
                "DEBRIEFING",
                "Este caso ainda não possui debriefing configurado."
            );

        }


        this.render();

    }


    /* ========================================================
       DICA
       ======================================================== */

    requestHint() {

        if (
            !this.state
        ) {

            return;

        }


        this.state.helpUsed++;


        this.score +=
            CONFIG.score.hint;


        let hint;


        if (
            !this.state.findings.length
        ) {

            hint =
                "Pense na investigação que mais reduz a incerteza diante da apresentação inicial.";

        } else if (
            !this.state.diagnosisEstablished
        ) {

            hint =
                "Use os achados já revelados para formular uma hipótese diagnóstica explícita.";

        } else if (
            !this.state.treatmentPerformed
        ) {

            hint =
                "Com o diagnóstico em mente, procure a conduta que modifica o desfecho e evite red flags.";

        } else {

            hint =
                "Revise segurança, evolução e disposição antes de encerrar.";

        }


        this.log(
            "warn",
            "DICA",
            `${hint} (${CONFIG.score.hint} pts)`
        );


        this.render();

    }


    /* ========================================================
       BASE CIENTÍFICA
       ======================================================== */

    scientificBase() {

        if (
            !this.case
        ) {

            return;

        }


        const discussion =
            this.case
                .knowledge
                .discussion ||
            {};


        const text =

            [

                `Patologia-alvo: ${this.case.pathology}`,

                `Fonte local: ${this.case.sourceId}`,

                "",

                discussion.takeaway
                    ? `Mensagem-chave:\n${discussion.takeaway}`
                    : "Mensagem-chave não configurada.",

                "",

                discussion.pathophysiology
                    ? `Fisiopatologia:\n${discussion.pathophysiology}`
                    : "Fisiopatologia não configurada.",

                "",

                "Esta V3 utiliza somente a Knowledge Base local. O botão ainda não realiza uma busca externa no PubMed."

            ]

            .join("\n");


        alert(text);

    }


    /* ========================================================
       LABELS
       ======================================================== */

    intentLabel(
        type
    ) {

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


        if (
            !container
        ) {

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
       RENDER
       ======================================================== */

    render() {

        if (
            !this.state
        ) {

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


        if (
            stabilityBar
        ) {

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


        if (
            list
        ) {

            list.innerHTML =
                "";


            const states = [

                `Contexto: ${
                    this.clinicalContext.setting
                }`,

                `Achados revelados: ${
                    this.state.findings.length
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


            for (
                const item
                of states
            ) {

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

    }


    /* ========================================================
       DOM HELPERS
       ======================================================== */

    setText(
        id,
        value
    ) {

        const element =
            document.getElementById(
                id
            );


        if (
            element
        ) {

            element.textContent =
                value;

        }

    }


    setInput(
        value
    ) {

        const input =
            document.getElementById(
                "actionInput"
            );


        if (
            input
        ) {

            input.value =
                value;

        }

    }

}


/* ============================================================
   BOOT
   ============================================================ */

let diagnosisEngine =
    null;


window.addEventListener(
    "DOMContentLoaded",
    async () => {

        diagnosisEngine =
            new DiagnosisEngineV2();


        window.idmtEngine =
            diagnosisEngine;


        try {

            await diagnosisEngine.init();

        } catch (error) {

            console.error(
                error
            );


            const log =
                document.getElementById(
                    "clinicalLog"
                );


            if (
                log
            ) {

                log.innerHTML =
                    "";


                const message =
                    document.createElement(
                        "div"
                    );


                message.className =
                    "msg danger";


                message.textContent =
                    `Falha ao iniciar o Engine: ${error.message}`;


                log.appendChild(
                    message
                );

            }

        }

    }
);
