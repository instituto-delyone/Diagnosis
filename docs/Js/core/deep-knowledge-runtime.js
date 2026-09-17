"use strict";

/*
 * Diagnosis — Deep Knowledge Runtime v1
 *
 * Adapts the existing local engine to Knowledge Base files that carry
 * clinical depth (degree 0–7) and complete simulated cases.
 *
 * This layer intentionally sits beside the existing engine so the old
 * knowledge corpus keeps working while the new schema is tested safely.
 */
(function () {
    const THEORY_FILE = "knowledge_base/anemia_theory_degree_v1.json";
    const CASES_FILE = "knowledge_base/anemia_clinical_cases_degree_v1.json";

    const normalize = value => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[!?.,;:()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const escapeHTML = value => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");

    class DeepKnowledgeRuntime {
        constructor() {
            this.theory = null;
            this.caseLibrary = null;
            this.loaded = false;
        }

        async load() {
            const [theoryResponse, casesResponse] = await Promise.all([
                fetch(`${THEORY_FILE}?v=1`, { cache: "no-store" }),
                fetch(`${CASES_FILE}?v=1`, { cache: "no-store" })
            ]);

            if (!theoryResponse.ok) {
                throw new Error(`Theory KB indisponível: ${theoryResponse.status}`);
            }
            if (!casesResponse.ok) {
                throw new Error(`Clinical Cases KB indisponível: ${casesResponse.status}`);
            }

            this.theory = await theoryResponse.json();
            this.caseLibrary = await casesResponse.json();
            this.loaded = true;

            return this.summary();
        }

        summary() {
            return {
                theoryFile: THEORY_FILE,
                casesFile: CASES_FILE,
                theoryDegree: this.theory?.depth_model?.default_target_degree ?? null,
                entities: this.theory?.entities?.length || 0,
                cases: this.caseLibrary?.cases?.length || 0,
                domain: this.theory?.domain || null
            };
        }

        randomCase() {
            const cases = this.caseLibrary?.cases || [];
            if (!cases.length) return null;
            return cases[Math.floor(Math.random() * cases.length)];
        }

        findCase(caseId) {
            return (this.caseLibrary?.cases || []).find(item => item.id === caseId) || null;
        }

        buildRuntimeCase(sourceCase) {
            if (!sourceCase) return null;

            const patient = sourceCase.patient || {};
            const history = sourceCase.history || {};
            const physical = sourceCase.physical_exam || {};
            const opening = sourceCase.opening || "Paciente apresenta quadro clínico a investigar.";

            const investigationNames = (sourceCase.propedeutics || [])
                .map(item => item.exam)
                .filter(Boolean);

            const diagnosis = sourceCase.primary_concept || null;
            const diagnosisAliases = [
                diagnosis,
                sourceCase.title,
                sourceCase.diagnostic_state?.hidden_diagnosis
            ].filter(Boolean);

            return {
                id: sourceCase.id,
                title: "Novo caso clínico",
                specialty: "Clínica Médica",
                difficulty: `Profundidade clínica ${sourceCase.degree}/7`,
                fictional: true,
                deepKnowledge: true,
                knowledgeDegree: sourceCase.degree || 7,
                source: {
                    theory: THEORY_FILE,
                    cases: CASES_FILE,
                    primaryConcept: diagnosis
                },
                demographics: {
                    age: patient.age,
                    sex: patient.sex,
                    occupation: patient.occupation
                },
                presentation: {
                    chief_complaint: {
                        narrative: opening,
                        labels: [],
                        symptoms: sourceCase.history?.symptoms || []
                    }
                },
                hidden: {
                    diagnosis: diagnosis,
                    title: sourceCase.title,
                    sourceCaseId: sourceCase.id
                },
                clinicalData: {
                    history,
                    physical_exam: physical,
                    initial_cbc: sourceCase.initial_cbc || null,
                    smear: sourceCase.smear || [],
                    hemolysis_panel: sourceCase.hemolysis_panel || sourceCase.hemolysis || null,
                    propedeutics: sourceCase.propedeutics || [],
                    differential: sourceCase.differential || [],
                    possible_actions: sourceCase.possible_actions || [],
                    consequences: sourceCase.consequences || {},
                    temporal_evolution: sourceCase.temporal_evolution || [],
                    clinical_challenges: sourceCase.clinical_challenges || [],
                    pitfall: sourceCase.pitfall || null
                },
                expected: {
                    investigation: investigationNames,
                    diagnosis: diagnosisAliases,
                    treatment: sourceCase.possible_actions || []
                },
                educational: {
                    etiology: "",
                    pathophysiology: "",
                    diagnosis: "",
                    treatment: "",
                    references: []
                }
            };
        }

        diagnosisMatches(input, sourceCase) {
            const value = normalize(input);
            const candidates = [
                sourceCase.primary_concept,
                sourceCase.title,
                sourceCase.diagnostic_state?.hidden_diagnosis
            ].filter(Boolean).map(normalize);

            return candidates.some(candidate =>
                value.includes(candidate) || candidate.includes(value)
            );
        }

        investigationMatch(input, sourceCase) {
            const value = normalize(input);
            const items = sourceCase.propedeutics || [];
            return items.find(item => {
                const exam = normalize(item.exam);
                return exam && (value.includes(exam) || exam.includes(value));
            }) || null;
        }

        renderKnowledgePanel(engine) {
            const summary = this.summary();
            engine.setResearch(`
                <h3>Knowledge Base — profundidade clínica</h3>
                <p><strong>Domínio:</strong> ${escapeHTML(summary.domain || "hematologia")}</p>
                <p><strong>Degree:</strong> ${escapeHTML(summary.theoryDegree)}/7</p>
                <p><strong>Entidades teóricas:</strong> ${escapeHTML(summary.entities)}</p>
                <p><strong>Casos disponíveis:</strong> ${escapeHTML(summary.cases)}</p>
                <p><strong>Teoria:</strong> ${escapeHTML(THEORY_FILE)}</p>
                <p><strong>Casos:</strong> ${escapeHTML(CASES_FILE)}</p>
                <p>O caso atual foi carregado da camada de casos profundos. O diagnóstico permanece oculto no início.</p>
            `);
        }
    }

    window.DeepKnowledgeRuntime = DeepKnowledgeRuntime;

    function install() {
        if (!window.DiagnosisEngine || !window.KnowledgeDrivenCaseGenerator) {
            console.warn("Deep Knowledge Runtime: engine principal ainda não está disponível.");
            return;
        }

        const originalBoot = window.DiagnosisEngine.prototype.boot;
        const originalStartNewCase = window.DiagnosisEngine.prototype.startNewCase;
        const originalEvaluateInvestigation = window.DiagnosisEngine.prototype.evaluateInvestigation;
        const originalEvaluateDiagnosis = window.DiagnosisEngine.prototype.evaluateDiagnosis;
        const originalAcademicAnswers = window.DiagnosisEngine.prototype.academicAnswers;
        const originalRender = window.DiagnosisEngine.prototype.render;

        window.DiagnosisEngine.prototype.boot = async function () {
            await originalBoot.call(this);
            this.deepKnowledge = new DeepKnowledgeRuntime();
            try {
                const summary = await this.deepKnowledge.load();
                this.log("KNOWLEDGE", `Deep Knowledge carregado: degree ${summary.theoryDegree}/7 · ${summary.entities} entidades · ${summary.cases} casos.`);
                this.deepKnowledge.renderKnowledgePanel(this);
            } catch (error) {
                this.log("KNOWLEDGE", `Falha ao carregar Deep Knowledge: ${error.message}`);
                console.error("Deep Knowledge Runtime:", error);
            }
        };

        window.DiagnosisEngine.prototype.startDeepCase = function () {
            if (!this.deepKnowledge?.loaded) return false;
            const sourceCase = this.deepKnowledge.randomCase();
            if (!sourceCase) return false;

            this.context = { phase: "investigation", history: [], answered: {}, pendingAction: null };
            this.score = 0;
            this.errors = 0;
            this.hints = 0;
            this.time = 0;
            this.research = null;
            this.clearLog();
            this.currentDeepSourceCase = sourceCase;
            this.currentCase = this.deepKnowledge.buildRuntimeCase(sourceCase);
            this.deepKnowledge.renderKnowledgePanel(this);

            this.log("NOVO CASO", `Paciente fictício · profundidade clínica ${sourceCase.degree}/7.`);
            this.log("PACIENTE", "Estou pronto. Você pode começar pela anamnese, exame físico ou solicitar uma investigação.");
            this.render();
            return true;
        };

        window.DiagnosisEngine.prototype.startNewCase = function () {
            if (this.deepKnowledge?.loaded && this.startDeepCase()) return;
            return originalStartNewCase.call(this);
        };

        window.DiagnosisEngine.prototype.evaluateInvestigation = function (input) {
            const sourceCase = this.currentDeepSourceCase;
            if (!sourceCase || !this.deepKnowledge?.loaded) {
                return originalEvaluateInvestigation.call(this, input);
            }

            const item = this.deepKnowledge.investigationMatch(input, sourceCase);
            this.time += 5;

            if (!item) {
                this.errors++;
                this.score--;
                this.log("INTERPRETAÇÃO", `Entendi a solicitação: ${input}. Esse exame não está disponível na propedêutica deste caso.`);
                this.render();
                return;
            }

            this.context.phase = "diagnosis";
            this.context.answered.investigation = true;
            this.context.answered.lastInvestigation = item.exam;
            this.score += 2;

            const result = item.expected_result || (Array.isArray(item.possible_results) ? item.possible_results[0] : "Resultado disponível no caso.");
            const interpretation = item.interpretation || "Interprete o resultado em conjunto com o quadro clínico.";

            this.log("INVESTIGAÇÃO", `${item.exam} solicitado.`);
            this.log("RESULTADO", result);
            this.log("INTERPRETAÇÃO", interpretation);
            this.log("PACIENTE", "Dado registrado. Você pode continuar a propedêutica ou formular uma hipótese diagnóstica.");
            this.render();
        };

        window.DiagnosisEngine.prototype.evaluateDiagnosis = function (input) {
            const sourceCase = this.currentDeepSourceCase;
            if (!sourceCase || !this.deepKnowledge?.loaded) {
                return originalEvaluateDiagnosis.call(this, input);
            }

            this.time += 1;
            if (!this.deepKnowledge.diagnosisMatches(input, sourceCase)) {
                this.errors++;
                this.score--;
                this.log("HIPÓTESE", `Hipótese registrada: ${input}. Ela ainda não corresponde ao estado diagnóstico oculto deste caso.`);
                this.render();
                return;
            }

            this.context.phase = "treatment";
            this.context.answered.diagnosis = true;
            this.score += 5;
            this.log("DIAGNÓSTICO", "Hipótese compatível com o caso.");
            this.log("PRÓXIMA ETAPA", "Estabeleça a conduta. O diagnóstico completo permanece oculto até o momento apropriado do fluxo.");
            this.render();
        };

        window.DiagnosisEngine.prototype.academicAnswers = function () {
            if (!this.currentDeepSourceCase || !this.deepKnowledge?.loaded) {
                return originalAcademicAnswers.call(this);
            }

            const source = this.currentDeepSourceCase;
            const c = source.clinical_challenges || [];
            const theoryEntity = (this.deepKnowledge.theory?.entities || []).find(entity => entity.id === source.primary_concept);
            const e = theoryEntity || {};

            const list = items => (items || []).map(item => `<li>${escapeHTML(typeof item === "string" ? item : JSON.stringify(item))}</li>`).join("");
            const lab = source.initial_cbc ? `<pre style="white-space:pre-wrap;background:#081522;padding:12px;border-radius:8px">${escapeHTML(JSON.stringify(source.initial_cbc, null, 2))}</pre>` : "Não informado.";

            this.setResearch(`
                <h3>${escapeHTML(source.title)}</h3>
                <p><strong>Clinical Knowledge Degree:</strong> ${escapeHTML(source.degree)}/7</p>
                <h4>Mecanismo</h4>
                <p>${escapeHTML(e.mechanism?.core || e.mechanism || "Consultar a entidade teórica correspondente.")}</p>
                <h4>Hemograma inicial</h4>
                ${lab}
                <h4>Propedêutica disponível</h4>
                <ul>${list(source.propedeutics)}</ul>
                <h4>Condutas possíveis</h4>
                <ul>${list(source.possible_actions)}</ul>
                <h4>Desafios clínicos</h4>
                <ul>${list(c)}</ul>
                <p><strong>Nota:</strong> esta área é feedback acadêmico; o diagnóstico não é exposto no início do caso.</p>
            `);
            this.log("BASE CIENTÍFICA", `Teoria e estrutura clínica do caso ${source.id} carregadas.`);
        };

        window.DiagnosisEngine.prototype.render = function () {
            originalRender.call(this);
            if (!this.currentCase || !this.currentCase.deepKnowledge) return;
            this.setText("caseTitle", "Novo paciente");
            this.setText("caseIntro", this.currentCase.presentation.chief_complaint.narrative);
            this.setText("difficultyLabel", `Degree ${this.currentCase.knowledgeDegree}/7`);
            this.setText("difficultyLabelMeta", `Degree ${this.currentCase.knowledgeDegree}/7`);
        };

        /*
         * O boot original já cria o primeiro caso antes do nosso runtime.
         * Assim que o Deep Knowledge terminar de carregar, substituímos por
         * um caso profundo. Os casos antigos continuam como fallback.
         */
        const originalBootWithDeep = window.DiagnosisEngine.prototype.boot;
        window.DiagnosisEngine.prototype.boot = async function () {
            await originalBootWithDeep.call(this);
            if (this.deepKnowledge?.loaded) this.startDeepCase();
        };

        console.info("Deep Knowledge Runtime instalado.");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", install, { once: true });
    } else {
        install();
    }
})();
