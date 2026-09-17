/**
 * ============================================================
 * DIAGNOSIS — CLINICAL INTERLOCUTOR
 * ============================================================
 * Camada de interpretação clínica entre linguagem do médico,
 * PatientState, investigação e conhecimento de interação.
 *
 * O interlocutor não diagnostica. Ele reconhece intenção,
 * consulta o estado permitido e devolve uma resposta estruturada.
 */
(function (global) {
    "use strict";

    class ClinicalInterlocutor {
        constructor(options = {}) {
            this.patientState = options.patientState || null;
            this.clinicalModel = options.clinicalModel || null;
            this.knowledgeBase = options.knowledgeBase || null;
            this.clinicalKnowledgeResolver = options.clinicalKnowledgeResolver || null;
            this.history = [];
            this.config = {
                revealUnknownVital: true,
                allowPatientQuestions: true,
                allowInvestigationRequests: true,
                allowExaminationRequests: true
            };
        }

        setPatientState(value) { this.patientState = value; }
        setClinicalModel(value) { this.clinicalModel = value; }
        setKnowledgeBase(value) { this.knowledgeBase = value; }
        setClinicalKnowledgeResolver(value) { this.clinicalKnowledgeResolver = value; }

        interpret(text) {
            const original = String(text || "").trim();
            if (!original) return this.response("empty", "Não recebi uma solicitação clínica.");
            const normalized = this.normalize(original);
            const result =
                this.interpretKnowledge(normalized) ||
                this.interpretVital(normalized) ||
                this.interpretPatientInteraction(normalized) ||
                this.interpretInvestigation(normalized) ||
                this.interpretPhysicalExamination(normalized) ||
                this.response("unknown", "Não consegui identificar exatamente o que você deseja avaliar ou solicitar.");
            this.history.push({ input: original, intent: result.intent, target: result.target || null, timestamp: Date.now() });
            return result;
        }

        /* ======================================================
           CONHECIMENTO CLÍNICO — NÃO ALTERA O PACIENTE
           ====================================================== */
        interpretKnowledge(text) {
            if (!this.clinicalKnowledgeResolver) return null;

            const markers = [
                "o que e", "explique", "me explique", "conceito de",
                "definicao de", "fisiopatologia", "etiologia",
                "apresentacao clinica", "achados clinicos", "sinais e sintomas de",
                "sintomas de", "diagnostico de", "como e feito o diagnostico de",
                "tratamento de", "manejo de", "prognostico de"
            ];
            if (!this.hasAny(text, markers)) return null;

            const results = this.clinicalKnowledgeResolver.resolve(text, { limit: 3 });
            if (!results.length) {
                return this.response("knowledge", "Não encontrei um trecho correspondente no corpus de conhecimento clínico disponível.", null, {
                    query: text, available: false, source: null, results: []
                });
            }

            const primary = results[0];
            const sourceText = this.clinicalKnowledgeResolver.getText(primary);
            const location = [primary.chapter, primary.section || primary.title || primary.topic].filter(Boolean).join(" > ");
            return this.response(
                "knowledge",
                location ? `${location}: ${sourceText || "Trecho localizado no corpus clínico."}` : (sourceText || "Trecho localizado no corpus clínico."),
                primary.id || null,
                {
                    query: text,
                    available: true,
                    source: primary.source || null,
                    chapter: primary.chapter || null,
                    section: primary.section || primary.title || null,
                    topic: primary.topic || null,
                    text: sourceText || null,
                    relevance: primary.relevance || null,
                    results
                }
            );
        }

        /* ======================================================
           SINAIS VITAIS
           ====================================================== */
        interpretVital(text) {
            if (this.hasAny(text, ["sinais vitais", "parametros vitais", "vital signs"])) return this.revealAllVitals();
            const patterns = [
                ["heart_rate", ["frequencia cardiaca", "fc", "pulso", "batimentos"]],
                ["spo2", ["saturacao", "spo2", "spo 2", "oximetria", "saturacao de oxigenio"]],
                ["blood_pressure", ["pressao arterial", "pa"]],
                ["glucose", ["glicemia", "glicose", "glicemia capilar"]],
                ["temperature", ["temperatura", "temperatura corporal"]],
                ["respiratory_rate", ["frequencia respiratoria", "fr", "respiracoes por minuto"]]
            ];
            for (const [target, terms] of patterns) if (this.hasAny(text, terms)) return this.revealVital(target);
            return null;
        }

        revealAllVitals() {
            const targets = ["heart_rate", "respiratory_rate", "blood_pressure", "spo2", "temperature", "glucose"];
            const labels = {
                heart_rate: "Frequência cardíaca", respiratory_rate: "Frequência respiratória",
                blood_pressure: "Pressão arterial", spo2: "SpO₂", temperature: "Temperatura", glucose: "Glicemia"
            };
            const values = {}, messages = [];
            for (const target of targets) {
                const value = this.readPatientValue(target);
                if (value !== undefined && value !== null && value !== "") {
                    values[target] = value;
                    messages.push(`${labels[target]}: ${this.formatVital(target, value)}`);
                }
            }
            if (!messages.length) return this.response("vital_signs", "Os sinais vitais ainda não estão disponíveis no estado clínico atual.", "vital_signs", { available: false, revealed: false });
            return this.response("vital_signs", `${messages.join(". ")}.`, "vital_signs", { values, available: true, revealed: true });
        }

        revealVital(target) {
            const value = this.readPatientValue(target);
            if (value === undefined || value === null || value === "") return this.response("vital", "Esse parâmetro ainda não está disponível no estado clínico atual.", target);
            const labels = {
                heart_rate: "Frequência cardíaca", spo2: "SpO₂", blood_pressure: "Pressão arterial",
                glucose: "Glicemia", temperature: "Temperatura", respiratory_rate: "Frequência respiratória"
            };
            return this.response("vital", `${labels[target] || target}: ${this.formatVital(target, value)}.`, target, { value, revealed: true });
        }

        /* ======================================================
           INTERAÇÃO COM O PACIENTE
           ====================================================== */
        interpretPatientInteraction(text) {
            if (!this.config.allowPatientQuestions) return null;
            const patterns = [
                ["chief_complaint", ["queixa principal", "motivo da consulta", "o que trouxe", "por que procurou", "porque procurou"]],
                ["onset", ["quando começou", "quando iniciou", "inicio dos sintomas", "há quanto tempo", "quanto tempo começou"]],
                ["pain", ["tem dor", "sente dor", "onde dói", "onde doi", "local da dor", "caracteristica da dor"]],
                ["fever", ["teve febre", "tem febre", "apresentou febre", "calafrio", "calafrios"]],
                ["medications", ["medicamentos", "remedios", "usa alguma medicacao", "usa medicamento", "toma algum medicamento"]],
                ["history", ["historia previa", "historia pregressa", "antecedentes", "historico", "anamnese"]]
            ];
            for (const [intent, terms] of patterns) if (this.hasAny(text, terms)) return this.revealPatientInformation(intent);
            return null;
        }

        revealPatientInformation(intent) {
            const aliases = {
                chief_complaint: ["chief_complaint", "queixa_principal", "complaint"],
                onset: ["onset", "inicio", "symptom_onset"],
                pain: ["pain", "dor"], fever: ["fever", "febre"],
                medications: ["medications", "medicamentos", "medication"],
                history: ["history", "antecedentes", "medical_history"]
            };
            const value = this.findPatientInformation(aliases[intent] || [intent]);
            const labels = {
                chief_complaint: "Queixa principal", onset: "Início dos sintomas", pain: "História da dor",
                fever: "História de febre", medications: "Medicações em uso", history: "Antecedentes"
            };
            if (value === undefined || value === null || value === "") return this.response("patient_interaction", "Essa informação não foi disponibilizada pelo paciente neste momento.", intent);
            return this.response("patient_interaction", `${labels[intent]}: ${this.stringifyValue(value)}.`, intent, { value, revealed: true });
        }

        /* ======================================================
           INVESTIGAÇÃO
           ====================================================== */
        interpretInvestigation(text) {
            if (!this.config.allowInvestigationRequests) return null;
            const patterns = [
                ["ecg", ["ecg", "eletro", "eletrocardiograma", "eletrocardiografia"]],
                ["blood_gas", ["gasometria", "gasometria arterial", "gasometria venosa"]],
                ["hemogram", ["hemograma"]],
                ["laboratory", ["exames laboratoriais", "laboratorio"]],
                ["ct", ["tomografia", "tc", "ct"]],
                ["chest_xray", ["raio x", "radiografia de torax", "rx de torax"]]
            ];
            for (const [target, terms] of patterns) if (this.hasAny(text, terms)) return this.requestInvestigation(target);
            return null;
        }

        requestInvestigation(target) {
            const result = this.findInvestigation(target);
            if (!result) return this.response("investigation", `A solicitação de ${this.labelInvestigation(target)} foi reconhecida, mas não há resultado disponível para este paciente.`, target, { ordered: true, available: false });
            return this.response("investigation", `${this.labelInvestigation(target)}: ${this.stringifyValue(result)}.`, target, { ordered: true, available: true, result, revealed: true });
        }

        /* ======================================================
           EXAME FÍSICO
           ====================================================== */
        interpretPhysicalExamination(text) {
            if (!this.config.allowExaminationRequests) return null;
            const patterns = [
                ["general", ["exame fisico geral", "aspecto geral", "estado geral"]],
                ["cardiovascular", ["exame cardiovascular", "exame cardiologico", "avaliacao cardiovascular", "ausculta cardiaca", "bulhas cardiacas"]],
                ["respiratory", ["exame respiratorio", "avaliacao respiratoria", "ausculta pulmonar", "ausculta respiratoria", "murmurio vesicular", "sons respiratorios"]],
                ["neurologic", ["exame neurologico", "avaliacao neurologica", "estado neurologico"]],
                ["abdomen", ["exame abdominal", "exame do abdomen", "palpacao abdominal"]],
                ["extremities", ["exame dos membros", "membros", "extremidades", "pulsos perifericos"]]
            ];
            for (const [target, terms] of patterns) if (this.hasAny(text, terms)) return this.revealPhysicalExamination(target);
            return null;
        }

        revealPhysicalExamination(target) {
            const value = this.findPhysicalExamination(target);
            if (value === undefined || value === null || value === "") return this.response("physical_examination", `O ${this.labelExamination(target)} não foi disponibilizado no estado clínico atual.`, target);
            return this.response("physical_examination", `${this.labelExamination(target)}: ${this.stringifyValue(value)}.`, target, { value, revealed: true });
        }

        /* ======================================================
           LEITURA DO PATIENT STATE
           ====================================================== */
        readPatientValue(target) {
            const state = this.patientState;
            if (!state) return undefined;
            if (typeof state.getVitals === "function") {
                const vitals = state.getVitals() || {};
                const direct = vitals[target];
                if (direct !== undefined) return direct;
                const aliases = { spo2: "oxygen_saturation", heart_rate: "heart_rate", respiratory_rate: "respiratory_rate", blood_pressure: "blood_pressure" };
                if (aliases[target] && vitals[aliases[target]] !== undefined) return vitals[aliases[target]];
            }
            const sources = [state.vitals, state.patient && state.patient.vitals, state.case && state.case.vitals, state.presentation && state.presentation.vitals].filter(Boolean);
            const aliases = { spo2: ["spo2", "oxygen_saturation", "oxygenSaturation"], heart_rate: ["heart_rate", "heartRate"], respiratory_rate: ["respiratory_rate", "respiratoryRate"], blood_pressure: ["blood_pressure", "bloodPressure"], glucose: ["glucose"], temperature: ["temperature"] };
            for (const source of sources) for (const key of aliases[target] || [target]) if (source[key] !== undefined) return source[key];
            return undefined;
        }

        findPatientInformation(keys) {
            const state = this.patientState;
            if (!state) return undefined;
            if (typeof state.getHistory === "function") {
                const history = state.getHistory();
                for (const key of keys) if (history && history[key] !== undefined) return history[key];
            }
            const sources = [state.history, state.patient && state.patient.history, state.case && state.case.history, state.patient, state.case && state.case.patient, state.hidden, state.case && state.case.hidden].filter(Boolean);
            for (const source of sources) for (const key of keys) if (source[key] !== undefined) return source[key];
            return undefined;
        }

        findInvestigation(target) {
            const state = this.patientState;
            if (!state) return undefined;
            if (typeof state.getInvestigations === "function") {
                const investigations = state.getInvestigations() || {};
                if (investigations[target] !== undefined) return investigations[target];
            }
            const aliases = { ecg: ["ecg", "electrocardiogram", "eletrocardiograma"], blood_gas: ["blood_gas", "gasometry", "gasometria"], hemogram: ["hemogram", "hemograma", "cbc"], laboratory: ["laboratory", "laboratorio", "labs"], ct: ["ct", "tc", "tomografia", "computed_tomography"], chest_xray: ["chest_xray", "xray", "rx_torax", "radiografia_torax"] };
            const sources = [state.investigations, state.exams, state.case && state.case.investigations, state.hidden && state.hidden.investigations, state.case && state.case.hidden && state.case.hidden.investigations].filter(Boolean);
            for (const source of sources) for (const key of aliases[target] || [target]) if (source[key] !== undefined) return source[key];
            return undefined;
        }

        findPhysicalExamination(target) {
            const state = this.patientState;
            if (!state) return undefined;
            if (typeof state.getPhysicalExam === "function") {
                const exam = state.getPhysicalExam() || {};
                if (exam[target] !== undefined) return exam[target];
            }
            const aliases = { general: ["general", "exame_geral", "general_exam"], cardiovascular: ["cardiovascular", "cardiac", "cardiovascular_exam"], respiratory: ["respiratory", "respiratory_exam", "pulmonary"], neurologic: ["neurologic", "neurological", "neurologic_exam"], abdomen: ["abdomen", "abdominal", "abdominal_exam"], extremities: ["extremities", "members", "limbs"] };
            const sources = [state.physical_exam, state.physicalExam, state.examination, state.exam, state.patient && state.patient.physical_exam, state.case && state.case.physical_exam].filter(Boolean);
            for (const source of sources) for (const key of aliases[target] || [target]) if (source[key] !== undefined) return source[key];
            return undefined;
        }

        response(intent, message, target = null, data = {}) { return { recognized: intent !== "unknown", intent, target, message, data }; }

        normalize(value) { return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[!?.,;:()[\]{}]/g, " ").replace(/\s+/g, " ").trim(); }

        hasAny(text, terms) {
            return terms.some(term => {
                const normalizedTerm = this.normalize(term);
                if (/^[a-z0-9]{1,3}$/i.test(normalizedTerm)) return new RegExp(`\\b${normalizedTerm}\\b`, "i").test(text);
                return text.includes(normalizedTerm);
            });
        }

        formatVital(target, value) {
            if (typeof value === "object") return this.stringifyValue(value);
            switch (target) {
                case "heart_rate": return `${value} bpm`;
                case "spo2": return `${value}%`;
                case "glucose": return `${value} mg/dL`;
                case "temperature": return `${value} °C`;
                case "respiratory_rate": return `${value} irpm`;
                default: return String(value);
            }
        }

        labelInvestigation(target) { return ({ ecg: "ECG", blood_gas: "Gasometria", hemogram: "Hemograma", laboratory: "Exames laboratoriais", ct: "Tomografia", chest_xray: "Radiografia de tórax" })[target] || target; }
        labelExamination(target) { return ({ general: "exame físico geral", cardiovascular: "exame cardiovascular", respiratory: "exame respiratório", neurologic: "exame neurológico", abdomen: "exame abdominal", extremities: "exame dos membros e extremidades" })[target] || target; }
        stringifyValue(value) { if (typeof value === "string") return value; if (typeof value === "number") return String(value); try { return JSON.stringify(value); } catch (_) { return String(value); } }
    }

    global.ClinicalInterlocutor = ClinicalInterlocutor;
})(typeof window !== "undefined" ? window : globalThis);
