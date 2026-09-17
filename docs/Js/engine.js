"use strict";

/*
 * DIAGNOSIS ENGINE
 *
 * Conversation flow:
 *
 *     investigation
 *          ↓
 *       diagnosis
 *          ↓
 *       treatment
 *          ↓
 *      completed
 *
 * This file is intentionally self-contained. It does not depend on
 * conversationContext being created by another file.
 */

(function () {
    const CONFIG = {
        roomFiles: {
            vermelha: [
                "knowledge_base/cirurgia_4.json",
                "knowledge_base/hipertensao_arterial.json",
                "cardiologia.json",
                "knowledge_base/neurologia.json",
                "knowledge_base/reumatologia.json",
                "knowledge_base/endocrinologia.json"
            ],
            clinica: [
                "knowledge_base/cirurgia_4.json",
                "knowledge_base/hipertensao_arterial.json",
                "cardiologia.json",
                "knowledge_base/neurologia.json",
                "knowledge_base/reumatologia.json",
                "knowledge_base/endocrinologia.json"
            ]
        },

        timeCost: {
            unknown: 1,
            investigation: 5,
            diagnosis: 1,
            treatment: 2,
            support: 1,
            patient_interaction: 1,
            examination: 1
        },

        score: {
            correctInvestigation: 2,
            correctDiagnosis: 5,
            correctTreatment: 5,
            incorrect: -1,
            hint: -3
        }
    };

    const PHASES = [
        "investigation",
        "diagnosis",
        "treatment",
        "completed"
    ];

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
        if (value === undefined || value === null) return value;

        try {
            return structuredClone(value);
        } catch (_) {
            try {
                return JSON.parse(JSON.stringify(value));
            } catch (_) {
                return value;
            }
        }
    }

    function array(value) {
        if (Array.isArray(value)) return value;
        if (value === undefined || value === null) return [];
        return [value];
    }

    function text(value) {
        if (value === undefined || value === null) return "";
        if (typeof value === "string") return value;

        try {
            return JSON.stringify(value);
        } catch (_) {
            return String(value);
        }
    }

    function containsAny(source, terms) {
        const normalizedSource = normalize(source);

        return array(terms).some(term => {
            const normalizedTerm = normalize(term);
            return normalizedTerm && normalizedSource.includes(normalizedTerm);
        });
    }

    function unique(values) {
        return [...new Set(
            array(values)
                .flat(Infinity)
                .map(value => normalize(value))
                .filter(Boolean)
        )];
    }

    function escapeHTML(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    class DiagnosisEngine {
        constructor() {
            const params = new URLSearchParams(window.location.search);

            this.room =
                params.get("sala") === "vermelha"
                    ? "vermelha"
                    : "clinica";

            this.elements = {};
            this.sources = [];
            this.currentSource = null;
            this.currentCase = null;
            this.caseIndex = 0;

            this.evaluation = {
                score: 0,
                mistakes: 0,
                hints: 0
            };

            /*
             * This was missing from the previous implementation.
             * Every conversation now has an explicit state.
             */
            this.conversationContext = {
                phase: "investigation",
                history: [],
                lastIntent: null,
                lastConcept: null,
                answered: {
                    investigation: false,
                    diagnosis: false,
                    treatment: false
                }
            };

            this.patient = {
                stability: 100,
                elapsedMinutes: 0,
                status: "active",
                vitals: {},
                events: []
            };
        }

        async boot() {
            this.bindUI();
            this.setRoomLabel();
            this.log("SISTEMA", "Carregando Diagnosis Engine...");

            await this.loadKnowledge();

            if (!this.sources.length) {
                this.log(
                    "AVISO",
                    "Não foi possível carregar a base de casos. Usando um caso clínico de demonstração."
                );

                this.currentCase = this.createFallbackCase();
            } else {
                this.startNewCase();
            }

            this.renderAll();
        }

        bindUI() {
            this.elements.input = document.getElementById("actionInput");
            this.elements.send = document.getElementById("sendBtn");
            this.elements.hint = document.getElementById("hintBtn");
            this.elements.science = document.getElementById("scienceBtn");
            this.elements.next = document.getElementById("nextBtn");
            this.elements.log = document.getElementById("clinicalLog");

            if (this.elements.send) {
                this.elements.send.addEventListener("click", () => {
                    this.submitInput();
                });
            }

            if (this.elements.input) {
                this.elements.input.addEventListener("keydown", event => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        this.submitInput();
                    }
                });
            }

            if (this.elements.hint) {
                this.elements.hint.addEventListener("click", () => {
                    this.requestHint();
                });
            }

            if (this.elements.science) {
                this.elements.science.addEventListener("click", () => {
                    this.showScientificBase();
                });
            }

            if (this.elements.next) {
                this.elements.next.addEventListener("click", () => {
                    this.startNewCase();
                });
            }
        }

        setRoomLabel() {
            const label =
                this.room === "vermelha"
                    ? "Sala Vermelha"
                    : "Sala Clínica";

            this.setText("roomLabel", label);
            this.setText("roomLabelMeta", label);
        }

        async loadKnowledge() {
            const files =
                CONFIG.roomFiles[this.room] || CONFIG.roomFiles.clinica;

            for (const file of files) {
                try {
                    const response = await fetch(file, {
                        cache: "no-store"
                    });

                    if (!response.ok) continue;

                    const json = await response.json();

                    this.sources.push({
                        file,
                        data: json
                    });
                } catch (error) {
                    console.warn("Falha ao carregar caso:", file, error);
                }
            }
        }

        startNewCase() {
            this.resetConversation();

            if (this.sources.length) {
                const source = this.sources[
                    this.caseIndex % this.sources.length
                ];

                this.caseIndex += 1;
                this.currentSource = source;
                this.currentCase = this.normalizeCase(
                    source.data,
                    source.file
                );
            } else {
                this.currentCase = this.createFallbackCase();
            }

            this.clearLog();

            this.log(
                "NOVO CASO",
                "Caso clínico iniciado. Comece pela investigação."
            );

            this.renderAll();
        }

        resetConversation() {
            this.conversationContext = {
                phase: "investigation",
                history: [],
                lastIntent: null,
                lastConcept: null,
                answered: {
                    investigation: false,
                    diagnosis: false,
                    treatment: false
                }
            };

            this.patient = {
                stability: 100,
                elapsedMinutes: 0,
                status: "active",
                vitals: {},
                events: []
            };
        }

        normalizeCase(raw, sourceFile) {
            /*
             * Supports both:
             *
             * 1. The old phase-based schema:
             *    fase_1_investigacao
             *
             * 2. Generated cases with:
             *    presentation, hidden_state, history, etc.
             */

            let source = clone(raw);

            if (Array.isArray(source)) {
                source = source[0] || {};
            }

            if (source.cases && Array.isArray(source.cases)) {
                source = source.cases[0] || {};
            }

            const investigation =
                source.fase_1_investigacao ||
                source.phase_1_investigation ||
                source.investigation ||
                {};

            const diagnosis =
                source.fase_2_diagnostico ||
                source.phase_2_diagnosis ||
                source.diagnosis ||
                {};

            const treatment =
                source.fase_3_conduta ||
                source.phase_3_treatment ||
                source.treatment ||
                {};

            const finalDiscussion =
                source.discussao_clinica_final ||
                source.final_discussion ||
                {};

            const presentation =
                source.presentation ||
                source.apresentacao ||
                {};

            const complaint =
                presentation.chief_complaint ||
                presentation.queixa_principal ||
                source.vinheta_admissao ||
                source.admission_vignette ||
                source.presentation ||
                source.description ||
                "Paciente em avaliação clínica.";

            const expected = {
                investigation: unique([
                    investigation.gabarito_esperado,
                    investigation.expected_answers,
                    investigation.expectedAnswers,
                    source.expected_investigation,
                    source.expectedInvestigation,

                    /*
                     * Generated cases may describe useful tests here.
                     */
                    source.investigations,
                    source.exams
                ]),

                diagnosis: unique([
                    diagnosis.gabarito_esperado,
                    diagnosis.expected_answers,
                    diagnosis.expectedAnswers,
                    source.expected_diagnosis,
                    source.expectedDiagnosis,
                    source.diagnosis_name,
                    source.diagnosisName,
                    source.nome_doenca,
                    source.disease_name,
                    source.hidden_state?.diagnosis,
                    source.hidden?.diagnosis
                ]),

                treatment: unique([
                    treatment.gabarito_esperado,
                    treatment.expected_answers,
                    treatment.expectedAnswers,
                    source.expected_treatment,
                    source.expectedTreatment,
                    source.treatment_name,
                    source.treatmentName,
                    source.hidden_state?.treatment,
                    source.hidden?.treatment
                ])
            };

            /*
             * Add common synonyms so clinically correct answers are not
             * rejected merely because wording differs.
             */
            expected.investigation.push(
                ...this.investigationAliases(expected.investigation)
            );

            expected.diagnosis.push(
                ...this.diagnosisAliases(expected.diagnosis)
            );

            expected.treatment.push(
                ...this.treatmentAliases(expected.treatment)
            );

            return {
                id:
                    source.id ||
                    source.id_doenca ||
                    `case_${Date.now()}`,

                title:
                    source.nome_doenca ||
                    source.disease_name ||
                    source.title ||
                    "Caso clínico",

                specialty:
                    source.especialidade ||
                    source.specialty ||
                    "Clínica médica",

                difficulty:
                    source.dificuldade ||
                    source.difficulty ||
                    "Não informada",

                complaint: text(complaint),

                raw: source,

                phases: {
                    investigation,
                    diagnosis,
                    treatment
                },

                expected,

                feedback: {
                    investigation:
                        investigation.achado_sucesso ||
                        investigation.success_feedback ||
                        "Investigação adequada. Os achados ajudam a reduzir a incerteza.",

                    diagnosis:
                        diagnosis.achado_sucesso ||
                        diagnosis.success_feedback ||
                        "Diagnóstico correto.",

                    treatment:
                        treatment.feedback_sucesso ||
                        treatment.success_feedback ||
                        "Conduta adequada para o caso.",

                    final:
                        finalDiscussion.takeaway_message ||
                        finalDiscussion.takeaway ||
                        "Caso resolvido. Revise o raciocínio clínico e a fisiopatologia."
                },

                sourceFile
            };
        }

        investigationAliases(values) {
            const result = [];

            for (const value of values) {
                const item = normalize(value);

                if (
                    item.includes("ecocardi") ||
                    item.includes("eco") ||
                    item.includes("pocus") ||
                    item.includes("ultrassom")
                ) {
                    result.push(
                        "ecocardiograma",
                        "ecocardiography",
                        "echocardiogram",
                        "pocus",
                        "ultrassom cardíaco",
                        "cardiac ultrasound"
                    );
                }

                if (item.includes("eletro") || item === "ecg") {
                    result.push(
                        "ecg",
                        "eletrocardiograma",
                        "electrocardiogram"
                    );
                }

                if (item.includes("raio x") || item.includes("radiografia")) {
                    result.push(
                        "radiografia",
                        "raio x",
                        "chest x ray",
                        "chest radiograph"
                    );
                }
            }

            return result;
        }

        diagnosisAliases(values) {
            const result = [];

            for (const value of values) {
                const item = normalize(value);

                if (
                    item.includes("tamponamento") ||
                    item.includes("cardiac tamponade")
                ) {
                    result.push(
                        "tamponamento",
                        "tamponamento cardiaco",
                        "cardiac tamponade",
                        "triade de beck",
                        "beck triad"
                    );
                }

                if (
                    item.includes("infarto") ||
                    item.includes("myocardial infarction")
                ) {
                    result.push(
                        "infarto",
                        "infarto agudo do miocardio",
                        "myocardial infarction",
                        "ami",
                        "stemi",
                        "nstemi"
                    );
                }

                if (
                    item.includes("pneumotorax") ||
                    item.includes("pneumothorax")
                ) {
                    result.push(
                        "pneumotorax",
                        "pneumotorax hipertensivo",
                        "tension pneumothorax"
                    );
                }

                if (
                    item.includes("tep") ||
                    item.includes("embolia pulmonar") ||
                    item.includes("pulmonary embolism")
                ) {
                    result.push(
                        "tep",
                        "embolia pulmonar",
                        "pulmonary embolism"
                    );
                }
            }

            return result;
        }

        treatmentAliases(values) {
            const result = [];

            for (const value of values) {
                const item = normalize(value);

                if (
                    item.includes("pericardiocentese") ||
                    item.includes("pericardial drainage")
                ) {
                    result.push(
                        "pericardiocentese",
                        "pericardial drainage",
                        "pericardial decompression"
                    );
                }

                if (
                    item.includes("intub") ||
                    item.includes("ventilacao mecanica") ||
                    item.includes("mechanical ventilation")
                ) {
                    result.push(
                        "intubacao",
                        "intubação",
                        "mechanical ventilation"
                    );
                }
            }

            return result;
        }

        createFallbackCase() {
            return {
                id: "fallback_cardiac_tamponade",
                title: "Tamponamento Cardíaco",
                specialty: "Cardiologia / Trauma",
                difficulty: "Avançada",

                complaint:
                    "Homem de 40 anos com ferimento por arma branca no tórax apresenta intensa falta de ar, agitação, turgência jugular, bulhas abafadas e hipotensão.",

                expected: {
                    investigation: [
                        "pocus",
                        "ultrassom",
                        "ecocardiograma",
                        "ecg",
                        "eletrocardiograma"
                    ],

                    diagnosis: [
                        "tamponamento",
                        "tamponamento cardiaco",
                        "cardiac tamponade",
                        "triade de beck"
                    ],

                    treatment: [
                        "pericardiocentese",
                        "janela pericardica",
                        "toracotomia",
                        "pericardial drainage"
                    ]
                },

                phases: {},

                feedback: {
                    investigation:
                        "O ultrassom cardíaco revela derrame pericárdico com colapso diastólico do ventrículo direito.",

                    diagnosis:
                        "Correto. O quadro é compatível com tamponamento cardíaco.",

                    treatment:
                        "Conduta salvadora: descompressão mecânica imediata, como pericardiocentese ou cirurgia.",

                    final:
                        "O tamponamento cardíaco causa choque obstrutivo por redução do enchimento diastólico."
                }
            };
        }

        submitInput() {
            const input = this.elements.input;
            const value = input ? input.value.trim() : "";

            if (!value) return;

            if (input) input.value = "";

            this.log("VOCÊ", value);
            this.processMessage(value);
        }

        processMessage(value) {
            const original = String(value || "").trim();
            const normalized = normalize(original);

            if (!normalized) return;

            const intent = this.detectIntent(normalized);

            this.conversationContext.history.push({
                input: original,
                normalized,
                phaseBefore: this.conversationContext.phase,
                intent,
                timestamp: Date.now()
            });

            this.conversationContext.lastIntent = intent;
            this.conversationContext.lastConcept = normalized;

            if (intent === "help") {
                this.requestHint();
                return;
            }

            if (intent === "score") {
                this.showScore();
                return;
            }

            if (intent === "new_case") {
                this.startNewCase();
                return;
            }

            if (intent === "investigation") {
                this.handleInvestigation(original);
                return;
            }

            if (intent === "diagnosis") {
                this.evaluateClinicalAnswer(original, "diagnosis");
                return;
            }

            if (intent === "treatment") {
                this.evaluateClinicalAnswer(original, "treatment");
                return;
            }

            if (intent === "question") {
                this.answerClinicalQuestion(original);
                return;
            }

            /*
             * Critical behavior:
             *
             * If the user simply writes:
             *
             *     cardiac tamponade
             *
             * the current phase determines how it should be evaluated.
             */
            this.evaluateClinicalAnswer(original, this.conversationContext.phase);
        }

        detectIntent(value) {
            if (
                containsAny(value, [
                    "dica",
                    "hint",
                    "ajuda",
                    "help",
                    "não sei",
                    "nao sei"
                ])
            ) {
                return "help";
            }

            if (
                containsAny(value, [
                    "pontuação",
                    "pontuacao",
                    "score",
                    "nota",
                    "quantos pontos"
                ])
            ) {
                return "score";
            }

            if (
                containsAny(value, [
                    "novo caso",
                    "proximo caso",
                    "próximo caso",
                    "new case",
                    "restart"
                ])
            ) {
                return "new_case";
            }

            if (
                containsAny(value, [
                    "ecg",
                    "eletrocardiograma",
                    "electrocardiogram",
                    "ecocardiograma",
                    "echocardiogram",
                    "pocus",
                    "ultrassom",
                    "ultrasound",
                    "tomografia",
                    "tomography",
                    "hemograma",
                    "gasometria",
                    "raio x",
                    "radiografia",
                    "exame",
                    "investigar",
                    "investigação",
                    "investigacao",
                    "investigate",
                    "order",
                    "solicito",
                    "solicitar"
                ])
            ) {
                return "investigation";
            }

            if (
                containsAny(value, [
                    "diagnóstico",
                    "diagnostico",
                    "diagnosis",
                    "diagnóstico é",
                    "diagnostico e",
                    "the diagnosis is",
                    "acredito que seja",
                    "i think this is"
                ])
            ) {
                return "diagnosis";
            }

            if (
                containsAny(value, [
                    "tratamento",
                    "tratar",
                    "conduta",
                    "manejo",
                    "treatment",
                    "manage",
                    "management",
                    "administro",
                    "administrar",
                    "prescrevo",
                    "prescrever",
                    "pericardiocentese",
                    "pericardial drainage",
                    "intubação",
                    "intubacao",
                    "intubate"
                ])
            ) {
                return "treatment";
            }

            if (
                containsAny(value, [
                    "qual a frequência",
                    "qual a frequencia",
                    "sinais vitais",
                    "vital signs",
                    "o que aconteceu",
                    "what happened",
                    "explique",
                    "explain",
                    "por que",
                    "porque",
                    "why",
                    "história",
                    "historia",
                    "history"
                ])
            ) {
                return "question";
            }

            return "answer";
        }

        handleInvestigation(original) {
            this.advanceTime("investigation");

            const expected = this.currentCase.expected.investigation;
            const matched = this.findMatchingAnswer(original, expected);

            if (matched) {
                this.evaluation.score += CONFIG.score.correctInvestigation;

                this.conversationContext.answered.investigation = true;

                this.log(
                    "CORRETO",
                    `${this.currentCase.feedback.investigation} Investigação reconhecida: ${matched}.`
                );

                this.advancePhase("diagnosis");
                return;
            }

            this.evaluation.score += CONFIG.score.incorrect;
            this.evaluation.mistakes += 1;

            this.log(
                "FEEDBACK",
                `A investigação foi registrada, mas não é a melhor próxima etapa para este caso. Tente um exame que reduza a principal incerteza clínica.`
            );

            this.renderAll();
        }

        evaluateClinicalAnswer(original, phase) {
            if (!PHASES.includes(phase)) {
                phase = "diagnosis";
            }

            if (phase === "completed") {
                this.log(
                    "CASO",
                    "Este caso já foi finalizado. Clique em “Próximo caso” para continuar."
                );
                return;
            }

            const expected = this.currentCase.expected[phase] || [];
            const matched = this.findMatchingAnswer(original, expected);

            if (matched) {
                this.evaluation.score +=
                    phase === "diagnosis"
                        ? CONFIG.score.correctDiagnosis
                        : CONFIG.score.correctTreatment;

                this.conversationContext.answered[phase] = true;

                this.log(
                    "CORRETO",
                    `${this.currentCase.feedback[phase]} Resposta reconhecida: ${matched}.`
                );

                if (phase === "diagnosis") {
                    this.advancePhase("treatment");
                } else if (phase === "treatment") {
                    this.finishCase();
                }

                return;
            }

            this.evaluation.score += CONFIG.score.incorrect;
            this.evaluation.mistakes += 1;

            this.log(
                "FEEDBACK",
                this.incorrectAnswerMessage(phase, original)
            );

            this.renderAll();
        }

        findMatchingAnswer(userText, expectedAnswers) {
            const normalizedUserText = normalize(userText);

            if (!normalizedUserText) return null;

            for (const answer of array(expectedAnswers)) {
                const normalizedAnswer = normalize(answer);

                if (!normalizedAnswer) continue;

                /*
                 * Allows:
                 *
                 * "The diagnosis is cardiac tamponade"
                 * "I think this is cardiac tamponade"
                 * "tamponamento cardíaco"
                 */
                if (
                    normalizedUserText.includes(normalizedAnswer) ||
                    normalizedAnswer.includes(normalizedUserText)
                ) {
                    return answer;
                }
            }

            return null;
        }

        incorrectAnswerMessage(phase, answer) {
            if (phase === "investigation") {
                return `"${answer}" foi registrado, mas ainda não corresponde à investigação esperada. Você pode pedir sinais vitais, exames, imagem ou exame físico.`;
            }

            if (phase === "diagnosis") {
                return `"${answer}" foi considerado, mas ainda não corresponde ao diagnóstico esperado. Revise os achados disponíveis e tente novamente.`;
            }

            if (phase === "treatment") {
                return `"${answer}" foi registrado, mas ainda não corresponde à conduta esperada. Considere a intervenção definitiva e os riscos imediatos.`;
            }

            return "Não consegui avaliar essa resposta no momento.";
        }

        advancePhase(nextPhase) {
            const current = this.conversationContext.phase;

            if (nextPhase) {
                this.conversationContext.phase = nextPhase;
            } else {
                const index = PHASES.indexOf(current);
                this.conversationContext.phase =
                    PHASES[Math.min(index + 1, PHASES.length - 1)];
            }

            const phase = this.conversationContext.phase;

            if (phase === "diagnosis") {
                this.log(
                    "PRÓXIMA ETAPA",
                    "Investigação concluída. Agora informe o diagnóstico mais provável."
                );
            }

            if (phase === "treatment") {
                this.log(
                    "PRÓXIMA ETAPA",
                    "Diagnóstico confirmado. Agora informe a conduta terapêutica."
                );
            }

            this.renderAll();
        }

        finishCase() {
            this.conversationContext.phase = "completed";
            this.patient.status = "completed";

            this.log(
                "CASO FINALIZADO",
                `${this.currentCase.feedback.final} Pontuação final: ${this.evaluation.score}.`
            );

            this.renderAll();
        }

        answerClinicalQuestion(original) {
            const value = normalize(original);

            if (
                containsAny(value, [
                    "sinais vitais",
                    "vital signs",
                    "frequencia cardiaca",
                    "frequência cardíaca",
                    "pressao arterial",
                    "pressão arterial",
                    "saturacao",
                    "saturação"
                ])
            ) {
                this.log(
                    "PACIENTE",
                    "Os sinais vitais estão disponíveis no monitor acima."
                );
                return;
            }

            if (
                containsAny(value, [
                    "historia",
                    "história",
                    "antecedentes",
                    "history"
                ])
            ) {
                this.log(
                    "PACIENTE",
                    "O paciente relata início recente dos sintomas e piora progressiva."
                );
                return;
            }

            this.log(
                "SISTEMA",
                "A pergunta foi registrada. Continue investigando o paciente e relacione os achados ao diagnóstico."
            );
        }

        requestHint() {
            this.evaluation.score += CONFIG.score.hint;
            this.evaluation.hints += 1;

            const phase = this.conversationContext.phase;

            const hints = {
                investigation:
                    "Dica: escolha o exame que mais rapidamente reduz a incerteza diante do quadro apresentado.",
                diagnosis:
                    "Dica: relacione os sinais, sintomas e resultados dos exames antes de escolher o diagnóstico.",
                treatment:
                    "Dica: escolha a conduta definitiva e evite intervenções que possam piorar a fisiopatologia.",
                completed:
                    "O caso já foi finalizado."
            };

            this.log("DICA", `${hints[phase]} (-3 pontos)`);
            this.renderAll();
        }

        showScore() {
            this.log(
                "PONTUAÇÃO",
                `Pontuação atual: ${this.evaluation.score}. Erros: ${this.evaluation.mistakes}. Dicas utilizadas: ${this.evaluation.hints}.`
            );
        }

        showScientificBase() {
            this.log(
                "BASE CIENTÍFICA",
                "Use a sequência clínica: reconhecer a gravidade, investigar a hipótese mais provável, estabelecer o diagnóstico e escolher a conduta definitiva."
            );
        }

        advanceTime(type) {
            this.patient.elapsedMinutes +=
                CONFIG.timeCost[type] || CONFIG.timeCost.unknown;
        }

        renderAll() {
            if (!this.currentCase) return;

            this.renderCase();
            this.renderPhase();
            this.renderScore();
            this.renderPatient();
        }

        renderCase() {
            this.setText("caseTitle", this.currentCase.title);
            this.setText("difficultyLabel", this.currentCase.difficulty);
            this.setText(
                "difficultyLabelMeta",
                this.currentCase.difficulty
            );
            this.setText("caseIntro", this.currentCase.complaint);
        }

        renderPhase() {
            const phase = this.conversationContext.phase;

            const phaseLabels = {
                investigation: "INVESTIGAÇÃO",
                diagnosis: "DIAGNÓSTICO",
                treatment: "CONDUTA",
                completed: "FINALIZADO"
            };

            this.setText("stateStatus", phaseLabels[phase] || "ATIVO");

            const stateList = document.getElementById("stateList");

            if (!stateList) return;

            stateList.innerHTML = `
                <li>
                    <span class="state-key">Fase atual</span>
                    <span class="state-value">${escapeHTML(
                        phaseLabels[phase] || phase
                    )}</span>
                </li>
                <li>
                    <span class="state-key">Tempo</span>
                    <span class="state-value">${this.patient.elapsedMinutes} min</span>
                </li>
                <li>
                    <span class="state-key">Diagnóstico</span>
                    <span class="state-value">${
                        this.conversationContext.answered.diagnosis
                            ? "Estabelecido"
                            : "Não estabelecido"
                    }</span>
                </li>
            `;
        }

        renderScore() {
            this.setText("score", this.evaluation.score);
        }

        renderPatient() {
            const stability = Math.max(
                0,
                Math.min(100, this.patient.stability)
            );

            this.setText("stabilityText", `${stability}%`);

            const bar = document.getElementById("stabilityBar");

            if (bar) {
                bar.style.width = `${stability}%`;

                if (stability < 30) {
                    bar.style.background = "#fb7185";
                } else if (stability < 60) {
                    bar.style.background = "#fbbf24";
                } else {
                    bar.style.background = "#34d399";
                }
            }
        }

        setText(id, value) {
            const element = document.getElementById(id);

            if (element) {
                element.textContent = String(value ?? "");
            }
        }

        clearLog() {
            if (this.elements.log) {
                this.elements.log.innerHTML = "";
            }
        }

        log(type, message) {
            const log = this.elements.log || document.getElementById("clinicalLog");

            if (!log) return;

            const entry = document.createElement("div");
            entry.className = "log-entry";

            const normalizedType = normalize(type);

            if (
                normalizedType.includes("correto") ||
                normalizedType.includes("sucesso")
            ) {
                entry.classList.add("success");
            } else if (
                normalizedType.includes("aviso") ||
                normalizedType.includes("feedback") ||
                normalizedType.includes("dica")
            ) {
                entry.classList.add("warning");
            } else if (
                normalizedType.includes("erro") ||
                normalizedType.includes("fatal")
            ) {
                entry.classList.add("danger");
            } else if (normalizedType.includes("voce")) {
                entry.classList.add("user");
            } else {
                entry.classList.add("system");
            }

            entry.innerHTML = `
                <strong>${escapeHTML(type)}</strong>
                <div>${escapeHTML(message)}</div>
            `;

            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }
    }

    window.DiagnosisEngine = DiagnosisEngine;
    window.idmtEngine = new DiagnosisEngine();

    document.addEventListener("DOMContentLoaded", () => {
        window.idmtEngine.boot().catch(error => {
            console.error("DIAGNOSIS ENGINE ERROR:", error);

            const log = document.getElementById("clinicalLog");

            if (log) {
                log.innerHTML = `
                    <div class="log-entry danger">
                        <strong>ERRO</strong>
                        <div>Não foi possível iniciar o motor clínico. Consulte o console do navegador.</div>
                    </div>
                `;
            }
        });
    });
})();