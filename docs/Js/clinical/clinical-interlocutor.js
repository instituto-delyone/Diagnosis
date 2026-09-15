/**
 * ============================================================
 * DIAGNOSIS — CLINICAL INTERLOCUTOR
 * ============================================================
 *
 * O interlocutor é a camada que traduz a linguagem do médico
 * em consultas/ações sobre o mundo clínico do paciente.
 *
 * MÉDICO
 *   ↓
 * INTERLOCUTOR
 *   ↓
 * INTENÇÃO CLÍNICA
 *   ↓
 * PATIENT STATE / KNOWLEDGE
 *   ↓
 * REVELAÇÃO
 *
 * O interlocutor conhece o estado completo do paciente,
 * mas só revela aquilo que o médico solicitou ou conseguiu
 * obter através da interação clínica.
 *
 * Não contém casos específicos.
 * Não contém diagnósticos fixos.
 * Não contém pontuação.
 * Não contém regras de jogo.
 *
 * ============================================================
 */

(function (global) {

    "use strict";

    class ClinicalInterlocutor {

        constructor(options = {}) {

            this.patientState = options.patientState || null;
            this.clinicalModel = options.clinicalModel || null;
            this.knowledgeBase = options.knowledgeBase || null;

            this.history = [];

            this.config = {
                revealUnknownVital: true,
                allowPatientQuestions: true,
                allowInvestigationRequests: true,
                allowExaminationRequests: true
            };
        }


        /* ======================================================
           CONFIGURAÇÃO
           ====================================================== */

        setPatientState(patientState) {
            this.patientState = patientState;
        }

        setClinicalModel(clinicalModel) {
            this.clinicalModel = clinicalModel;
        }

        setKnowledgeBase(knowledgeBase) {
            this.knowledgeBase = knowledgeBase;
        }


        /* ======================================================
           ENTRADA PRINCIPAL
           ====================================================== */

        interpret(text) {

            const original = String(text || "").trim();

            if (!original) {
                return this.response(
                    "empty",
                    "Não recebi uma solicitação clínica."
                );
            }

            const normalized = this.normalize(original);

            let result = null;

            /*
             * A ordem é importante.
             *
             * Primeiro identificamos consultas específicas.
             * Depois interação com o paciente.
             * Depois exames.
             * Depois avaliação/exame físico.
             */

            result =
                this.interpretVital(normalized) ||
                this.interpretPatientInteraction(normalized) ||
                this.interpretInvestigation(normalized) ||
                this.interpretPhysicalExamination(normalized);

            if (!result) {
                return this.response(
                    "unknown",
                    "Não consegui identificar exatamente o que você deseja avaliar ou solicitar."
                );
            }

            this.history.push({
                input: original,
                intent: result.intent,
                target: result.target || null,
                timestamp: Date.now()
            });

            return result;
        }


        /* ======================================================
           SINAIS VITAIS
           ====================================================== */

        interpretVital(text) {

            const patterns = [

                {
                    target: "heart_rate",
                    terms: [
                        "frequencia cardiaca",
                        "frequencia cardíaca",
                        "fc",
                        "pulso",
                        "batimentos"
                    ]
                },

                {
                    target: "spo2",
                    terms: [
                        "saturacao",
                        "saturação",
                        "spo2",
                        "spo 2",
                        "oximetria"
                    ]
                },

                {
                    target: "blood_pressure",
                    terms: [
                        "pressao arterial",
                        "pressão arterial",
                        "pressao",
                        "pressão",
                        "pa"
                    ]
                },

                {
                    target: "glucose",
                    terms: [
                        "glicemia",
                        "glicose"
                    ]
                },

                {
                    target: "temperature",
                    terms: [
                        "temperatura",
                        "febre"
                    ]
                },

                {
                    target: "respiratory_rate",
                    terms: [
                        "frequencia respiratoria",
                        "frequência respiratória",
                        "fr",
                        "respiracoes",
                        "respirações"
                    ]
                }
            ];

            for (const item of patterns) {

                if (!this.hasAny(text, item.terms)) {
                    continue;
                }

                return this.revealVital(item.target);
            }

            return null;
        }


        revealVital(target) {

            const value = this.readPatientValue(target);

            if (value === undefined || value === null || value === "") {

                return this.response(
                    "vital",
                    "Esse parâmetro ainda não está disponível no estado clínico atual.",
                    target
                );
            }

            const labels = {
                heart_rate: "Frequência cardíaca",
                spo2: "SpO₂",
                blood_pressure: "Pressão arterial",
                glucose: "Glicemia",
                temperature: "Temperatura",
                respiratory_rate: "Frequência respiratória"
            };

            return this.response(
                "vital",
                `${labels[target]}: ${this.formatVital(target, value)}.`,
                target,
                {
                    value: value,
                    revealed: true
                }
            );
        }


        /* ======================================================
           INTERAÇÃO COM O PACIENTE
           ====================================================== */

        interpretPatientInteraction(text) {

            if (!this.config.allowPatientQuestions) {
                return null;
            }

            const patterns = [

                {
                    intent: "chief_complaint",
                    terms: [
                        "queixa principal",
                        "motivo da consulta",
                        "o que trouxe",
                        "por que procurou",
                        "porque procurou",
                        "o que fez procurar"
                    ]
                },

                {
                    intent: "onset",
                    terms: [
                        "quando começou",
                        "quando iniciou",
                        "inicio dos sintomas",
                        "início dos sintomas",
                        "há quanto tempo",
                        "quanto tempo começou"
                    ]
                },

                {
                    intent: "pain",
                    terms: [
                        "tem dor",
                        "sente dor",
                        "onde dói",
                        "onde doi",
                        "local da dor",
                        "caracteristica da dor",
                        "característica da dor"
                    ]
                },

                {
                    intent: "fever",
                    terms: [
                        "teve febre",
                        "tem febre",
                        "apresentou febre",
                        "calafrio",
                        "calafrios"
                    ]
                },

                {
                    intent: "medications",
                    terms: [
                        "medicamentos",
                        "remedios",
                        "remédios",
                        "usa alguma medicação",
                        "usa medicamento",
                        "toma algum medicamento"
                    ]
                },

                {
                    intent: "history",
                    terms: [
                        "historia previa",
                        "história prévia",
                        "antecedentes",
                        "historico",
                        "histórico",
                        "anamnese"
                    ]
                }
            ];

            for (const item of patterns) {

                if (!this.hasAny(text, item.terms)) {
                    continue;
                }

                return this.revealPatientInformation(item.intent);
            }

            return null;
        }


        revealPatientInformation(intent) {

            const aliases = {
                chief_complaint: [
                    "chief_complaint",
                    "queixa_principal",
                    "complaint"
                ],

                onset: [
                    "onset",
                    "inicio",
                    "symptom_onset"
                ],

                pain: [
                    "pain",
                    "dor"
                ],

                fever: [
                    "fever",
                    "febre"
                ],

                medications: [
                    "medications",
                    "medicamentos",
                    "medication"
                ],

                history: [
                    "history",
                    "antecedentes",
                    "medical_history"
                ]
            };

            const value = this.findPatientInformation(
                aliases[intent] || [intent]
            );

            const labels = {
                chief_complaint: "Queixa principal",
                onset: "Início dos sintomas",
                pain: "História da dor",
                fever: "História de febre",
                medications: "Medicações em uso",
                history: "Antecedentes"
            };

            if (value === undefined || value === null || value === "") {

                return this.response(
                    "patient_interaction",
                    "Essa informação não foi disponibilizada pelo paciente neste momento.",
                    intent
                );
            }

            return this.response(
                "patient_interaction",
                `${labels[intent]}: ${this.stringifyValue(value)}.`,
                intent,
                {
                    value: value,
                    revealed: true
                }
            );
        }


        /* ======================================================
           INVESTIGAÇÃO / EXAMES
           ====================================================== */

        interpretInvestigation(text) {

            if (!this.config.allowInvestigationRequests) {
                return null;
            }

            const investigations = [

                {
                    target: "ecg",
                    terms: [
                        "ecg",
                        "eletro",
                        "eletrocardiograma",
                        "eletrocardiografia"
                    ]
                },

                {
                    target: "blood_gas",
                    terms: [
                        "gasometria",
                        "gasometria arterial",
                        "gasometria venosa"
                    ]
                },

                {
                    target: "hemogram",
                    terms: [
                        "hemograma"
                    ]
                },

                {
                    target: "laboratory",
                    terms: [
                        "exames laboratoriais",
                        "laboratorio",
                        "laboratório"
                    ]
                },

                {
                    target: "ct",
                    terms: [
                        "tomografia",
                        "tc",
                        "ct"
                    ]
                },

                {
                    target: "chest_xray",
                    terms: [
                        "raio x",
                        "radiografia de torax",
                        "radiografia de tórax",
                        "rx de torax",
                        "rx de tórax"
                    ]
                }
            ];

            for (const item of investigations) {

                if (!this.hasAny(text, item.terms)) {
                    continue;
                }

                return this.requestInvestigation(item.target);
            }

            return null;
        }


        requestInvestigation(target) {

            const result = this.findInvestigation(target);

            if (!result) {

                return this.response(
                    "investigation",
                    `A solicitação de ${this.labelInvestigation(target)} foi reconhecida, mas não há resultado disponível para este paciente.`,
                    target,
                    {
                        ordered: true,
                        available: false
                    }
                );
            }

            return this.response(
                "investigation",
                `${this.labelInvestigation(target)}: ${this.stringifyValue(result)}.`,
                target,
                {
                    ordered: true,
                    available: true,
                    result: result,
                    revealed: true
                }
            );
        }


        /* ======================================================
           EXAME FÍSICO
           ====================================================== */

        interpretPhysicalExamination(text) {

            if (!this.config.allowExaminationRequests) {
                return null;
            }

            const examinations = [

                {
                    target: "primary_assessment",
                    terms: [
                        "abcde",
                        "avaliacao primaria",
                        "avaliação primária",
                        "avaliacao inicial",
                        "avaliação inicial"
                    ]
                },

                {
                    target: "mental_status",
                    terms: [
                        "nivel de consciencia",
                        "nível de consciência",
                        "estado mental",
                        "consciencia",
                        "consciência"
                    ]
                },

                {
                    target: "perfusion",
                    terms: [
                        "perfusao",
                        "perfusão",
                        "enchimento capilar",
                        "pulsos perifericos",
                        "pulsos periféricos"
                    ]
                },

                {
                    target: "monitoring",
                    terms: [
                        "monitorizar",
                        "monitorar",
                        "monitorizacao",
                        "monitorização"
                    ]
                }
            ];

            for (const item of examinations) {

                if (!this.hasAny(text, item.terms)) {
                    continue;
                }

                return this.performExamination(item.target);
            }

            return null;
        }


        performExamination(target) {

            const result = this.findPatientInformation([
                target,
                `exam_${target}`,
                `examination_${target}`
            ]);

            if (!result) {

                return this.response(
                    "physical_examination",
                    `Avaliação de ${this.labelExamination(target)} realizada. Nenhum achado adicional foi disponibilizado.`,
                    target,
                    {
                        performed: true,
                        available: false
                    }
                );
            }

            return this.response(
                "physical_examination",
                `${this.labelExamination(target)}: ${this.stringifyValue(result)}.`,
                target,
                {
                    performed: true,
                    available: true,
                    result: result,
                    revealed: true
                }
            );
        }


        /* ======================================================
           LEITURA DO PATIENT STATE
           ====================================================== */

        readPatientValue(target) {

            if (!this.patientState) {
                return undefined;
            }

            const state = this.patientState;

            const maps = {

                heart_rate: [
                    "heartRate",
                    "heart_rate",
                    "fc",
                    "frequenciaCardiaca",
                    "frequencia_cardiaca"
                ],

                spo2: [
                    "spo2",
                    "SpO2",
                    "oxygenSaturation",
                    "oxygen_saturation"
                ],

                blood_pressure: [
                    "bloodPressure",
                    "blood_pressure",
                    "pa",
                    "pressaoArterial",
                    "pressao_arterial"
                ],

                glucose: [
                    "glucose",
                    "glicemia",
                    "bloodGlucose",
                    "blood_glucose"
                ],

                temperature: [
                    "temperature",
                    "temperatura"
                ],

                respiratory_rate: [
                    "respiratoryRate",
                    "respiratory_rate",
                    "fr",
                    "frequenciaRespiratoria"
                ]
            };

            const keys = maps[target] || [target];

            for (const key of keys) {

                if (state[key] !== undefined) {
                    return state[key];
                }

                if (state.vitals && state.vitals[key] !== undefined) {
                    return state.vitals[key];
                }

                if (state.patient && state.patient[key] !== undefined) {
                    return state.patient[key];
                }

                if (state.patient && state.patient.vitals &&
                    state.patient.vitals[key] !== undefined) {

                    return state.patient.vitals[key];
                }

                if (state.case && state.case[key] !== undefined) {
                    return state.case[key];
                }

                if (state.case && state.case.vitals &&
                    state.case.vitals[key] !== undefined) {

                    return state.case.vitals[key];
                }
            }

            return undefined;
        }


        findPatientInformation(keys) {

            if (!this.patientState) {
                return undefined;
            }

            const sources = [
                this.patientState,
                this.patientState.patient,
                this.patientState.case,
                this.patientState.case && this.patientState.case.patient,
                this.patientState.hidden,
                this.patientState.case && this.patientState.case.hidden,
                this.patientState.presentation
            ].filter(Boolean);

            for (const source of sources) {

                for (const key of keys) {

                    if (source[key] !== undefined) {
                        return source[key];
                    }
                }
            }

            return undefined;
        }


        findInvestigation(target) {

            if (!this.patientState) {
                return undefined;
            }

            const sources = [
                this.patientState.investigations,
                this.patientState.exams,
                this.patientState.case &&
                    this.patientState.case.investigations,
                this.patientState.case &&
                    this.patientState.case.exams,
                this.patientState.hidden &&
                    this.patientState.hidden.investigations
            ].filter(Boolean);

            for (const source of sources) {

                if (source[target] !== undefined) {
                    return source[target];
                }

                const normalizedTarget = this.normalize(target);

                for (const key of Object.keys(source)) {

                    if (this.normalize(key) === normalizedTarget) {
                        return source[key];
                    }
                }
            }

            return undefined;
        }


        /* ======================================================
           RESPOSTA PADRONIZADA
           ====================================================== */

        response(intent, message, target = null, data = {}) {

            return {
                recognized: intent !== "unknown",
                intent: intent,
                target: target,
                message: message,
                data: data
            };
        }


        /* ======================================================
           UTILITÁRIOS
           ====================================================== */

        normalize(value) {

            return String(value || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[!?.,;:()[\]{}]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        }


        hasAny(text, terms) {

            return terms.some(term =>
                text.includes(this.normalize(term))
            );
        }


        formatVital(target, value) {

            if (typeof value === "object") {
                return this.stringifyValue(value);
            }

            switch (target) {

                case "heart_rate":
                    return `${value} bpm`;

                case "spo2":
                    return `${value}%`;

                case "glucose":
                    return `${value} mg/dL`;

                case "temperature":
                    return `${value} °C`;

                case "respiratory_rate":
                    return `${value} irpm`;

                default:
                    return String(value);
            }
        }


        labelInvestigation(target) {

            const labels = {
                ecg: "ECG",
                blood_gas: "Gasometria",
                hemogram: "Hemograma",
                laboratory: "Exames laboratoriais",
                ct: "Tomografia",
                chest_xray: "Radiografia de tórax"
            };

            return labels[target] || target;
        }


        labelExamination(target) {

            const labels = {
                primary_assessment: "avaliação primária",
                mental_status: "nível de consciência",
                perfusion: "perfusão",
                monitoring: "monitorização"
            };

            return labels[target] || target;
        }


        stringifyValue(value) {

            if (typeof value === "string") {
                return value;
            }

            if (typeof value === "number") {
                return String(value);
            }

            try {
                return JSON.stringify(value);
            } catch (error) {
                return String(value);
            }
        }
    }


    /* ==========================================================
       EXPOSIÇÃO GLOBAL
       ========================================================== */

    global.ClinicalInterlocutor = ClinicalInterlocutor;

})(window);
