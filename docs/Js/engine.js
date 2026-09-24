"use strict";

/*
 * Diagnosys — clinical simulation orchestrator.
 *
 * This layer owns the patient truth, case presentation and conversation loop.
 * Knowledge/research/building are delegated to dedicated modules when available.
 */
(function (global) {
    const CONFIG = {
        knowledgeSourcesManifest: "knowledge_base/knowledge_sources_manifest.json",
        caseLibraries: [],
        theoryLibraries: [],
        researchRules: "AI/CASE_RESEARCH_RULES.json",
        pcdtCatalog: "knowledge_base/pcdt_catalog.json",
        defaultRoom: "clinica",
        geminiWorkerUrl: "https://diagnosis-gemini-proxy.dr-delyone.workers.dev/api/gemini/research"
    };

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
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const flatten = value => Array.isArray(value) ? value.flat(Infinity) : value == null ? [] : [value];

    async function loadScript(src, timeoutMs = 10000) {
        if ([...document.scripts].some(script => script.src.endsWith(src))) return;
        await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            let settled = false;
            const finish = (fn, value) => {
                if (settled) return;
                settled = true;
                global.clearTimeout(timer);
                fn(value);
            };
            const timer = global.setTimeout(() => {
                finish(reject, new Error("Tempo esgotado ao carregar " + src));
            }, timeoutMs);
            script.src = src;
            script.onload = () => finish(resolve);
            script.onerror = () => finish(reject, new Error("Falha ao carregar " + src));
            document.head.appendChild(script);
        });
    }

    class CaseLibrary {
        constructor(paths = CONFIG.caseLibraries) {
            this.paths = Array.isArray(paths) ? paths : [];
            this.cases = [];
            this.theory = [];
            this.sources = [];
            this.stats = { files: 0, records: 0, playable: 0 };
        }

        normalize(value) {
            return String(value || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[^a-z0-9\\s]/g, " ")
                .replace(/\\s+/g, " ")
                .trim();
        }

        slug(value) {
            return this.normalize(value).replace(/\\s+/g, "_") || "concept";
        }

        isDiseaseLike(item) {
            const type = this.normalize(item?.type || item?.category || "");
            return ["disease", "diagnosis", "syndrome", "condition", "disorder", "complication"].includes(type)
                || !!(item?.patologia_alvo || item?.diagnosis || item?.clinical_truth);
        }

        collectManifestations(item) {
            const values = [];
            const add = value => {
                if (!value) return;
                if (typeof value === "string") values.push(value);
                else if (Array.isArray(value)) value.forEach(add);
                else if (typeof value === "object") Object.values(value).forEach(add);
            };
            add(item?.manifestations);
            add(item?.features);
            add(item?.clinical_features);
            add(item?.presentations);
            add(item?.clinical?.presentations);
            add(item?.clinical?.symptoms);
            add(item?.clinical?.signs);
            return [...new Set(values.map(v => String(v).trim()).filter(Boolean))].slice(0, 12);
        }

        collectInvestigations(item) {
            const raw = item?.investigations || item?.investigation || item?.exams || [];
            const list = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);
            return list.map((x, i) => {
                if (!x) return null;
                const exam = x.name || x.exam || x.id || ("investigacao_" + (i + 1));
                let result = x.result ?? x.expected_result;
                const possible = Array.isArray(x.possible_results) ? x.possible_results : [];
                if ((result == null || result === "") && possible.length) result = possible[0];
                if (result == null || result === "") {
                    const candidates = x.results || x.possibleResults;
                    if (Array.isArray(candidates) && candidates.length) result = candidates[0];
                }
                if (result == null || result === "") result = "Resultado não determinante no caso inicial.";
                return {
                    id: x.id || this.slug(exam),
                    exam: String(exam),
                    name: x.name || String(exam),
                    result,
                    interpretation: x.interpretation || null,
                    available: x.available !== false,
                    performed: false,
                    source: "knowledge_base"
                };
            }).filter(Boolean).slice(0, 10);
        }

        entityToCase(item, sourcePath, index) {
            const concept = item?.name || item?.canonical_name || item?.patologia_alvo || item?.title || item?.id_caso;
            if (!concept || !this.isDiseaseLike(item)) return null;

            const manifestations = this.collectManifestations(item);
            const inv = this.collectInvestigations(item);
            const patient = {
                age: item?.epidemiology?.age_range
                    ? Math.round((item.epidemiology.age_range[0] + item.epidemiology.age_range[1]) / 2)
                    : 45,
                sex: item?.epidemiology?.sex_distribution === "female"
                    ? "feminino"
                    : item?.epidemiology?.sex_distribution === "male"
                        ? "masculino"
                        : (Math.random() < 0.5 ? "feminino" : "masculino")
            };

            const complaint = manifestations[0] || ("avaliação por " + concept);
            const risk = Array.isArray(item?.risk_factors)
                ? item.risk_factors.map(x => typeof x === "string" ? x : x?.id).filter(Boolean)
                : [];
            const differentials = item?.differentials
                || item?.diagnosis?.differential_diagnoses
                || item?.differential_diagnoses
                || [];

            if (!inv.length) {
                inv.push({
                    id: "avaliacao_clinica_inicial",
                    exam: "avaliação clínica dirigida",
                    name: "Avaliação clínica dirigida",
                    result: manifestations.length
                        ? "Achados clínicos registrados: " + manifestations.slice(0, 4).join("; ") + "."
                        : "Avaliação clínica inicial sem achado específico registrado.",
                    available: true,
                    performed: false,
                    source: "knowledge_base"
                });
            }

            return {
                id: "kb_" + this.slug(sourcePath.replace(/\.json$/, "")) + "_" + this.slug(concept) + "_" + index,
                primary_concept: concept,
                concept_id: item?.id || null,
                title: concept,
                difficulty: item?.difficulty?.base
                    ? ({1:"Básica",2:"Básica",3:"Intermediária",4:"Avançada",5:"Avançada"}[item.difficulty.base] || "Intermediária")
                    : item?.dificuldade || "Simulação clínica",
                patient,
                opening: {
                    chief_complaint: complaint,
                    initial_narrative: patient.sex === "feminino"
                        ? "Mulher de " + patient.age + " anos chega para avaliação por " + complaint + "."
                        : "Homem de " + patient.age + " anos chega para avaliação por " + complaint + "."
                },
                initial_state: { stability: "estável", severity: "não classificada" },
                history: { risk_factors: risk, symptoms: manifestations.slice(0, 6) },
                physical_exam: { findings: manifestations.slice(0, 8) },
                vitals: {},
                investigations: { catalog: inv },
                management: {
                    possible_actions: item?.treatments || item?.treatment?.acute || item?.fase_3_conduta?.gabarito_esperado || []
                },
                evolution: { temporal_evolution: [], consequences: {} },
                clinical_truth: {
                    symptoms: manifestations.slice(0, 6),
                    signs: manifestations.slice(0, 8),
                    risk_factors: risk,
                    differentials
                },
                hidden: {
                    diagnosis: item?.id || concept,
                    label: concept,
                    pathophysiology: item?.pathophysiology || item?.definition || item?.etiology || {},
                    differential: differentials
                },
                kb_source: sourcePath,
                kb_entity_id: item?.id || null
            };
        }

        adaptRecord(item, sourcePath, index) {
            if (!item || typeof item !== "object") return null;

            if (item.vinheta_admissao || item.patologia_alvo) {
                return this.legacyCaseToSource(item, sourcePath, index);
            }

            if ((item.id || item.case_id) && (item.hidden || item.clinical_truth || item.primary_concept)) {
                return item;
            }

            return this.entityToCase(item, sourcePath, index);
        }

        legacyCaseToSource(item, sourcePath, index) {
            const target = item.patologia_alvo || item.primary_concept || item.title || item.id_caso;
            const f1 = item.fase_1_investigacao || {};
            const f2 = item.fase_2_diagnostico || {};
            const f3 = item.fase_3_conduta || {};
            return {
                id: item.id_caso || ("kb_" + this.slug(sourcePath) + "_" + index),
                primary_concept: target,
                title: target,
                difficulty: item.dificuldade || "Intermediária",
                patient: { age: item.idade || 45, sex: item.sexo || "feminino" },
                opening: { chief_complaint: item.vinheta_admissao, initial_narrative: item.vinheta_admissao },
                initial_state: { stability: "estável", severity: item.dificuldade || "não classificada" },
                history: {},
                physical_exam: {},
                vitals: {},
                investigations: {
                    catalog: [{
                        id: "investigacao_inicial",
                        exam: "investigação direcionada",
                        name: "Investigação direcionada",
                        result: f1.achado_sucesso || "Investigação compatível com o quadro clínico.",
                        available: true,
                        performed: false
                    }]
                },
                management: { possible_actions: f3.gabarito_esperado || [] },
                evolution: {},
                clinical_truth: { symptoms: [], signs: [], differentials: f2.distrator_comum || [] },
                hidden: {
                    diagnosis: target,
                    label: target,
                    pathophysiology: item.discussao_clinica_final?.fisiopatologia || {},
                    differential: f2.distrator_comum || []
                },
                kb_source: sourcePath,
                kb_entity_id: item.id_caso || null
            };
        }

        async loadManifest() {
            try {
                const response = await fetch(CONFIG.knowledgeSourcesManifest, { cache: "no-store" });
                if (!response.ok) throw new Error("HTTP " + response.status);
                const manifest = await response.json();
                return Array.isArray(manifest.include) ? manifest.include : [];
            } catch (error) {
                console.warn("Manifesto universal da Knowledge Base indisponível:", error);
                return [];
            }
        }

        async load() {
            this.cases = [];
            this.theory = [];
            this.sources = [];
            this.stats = { files: 0, records: 0, playable: 0 };

            const manifestPaths = await this.loadManifest();
            const paths = [...new Set([...(this.paths || []), ...manifestPaths])];

            for (const path of paths) {
                try {
                    const cleanPath = String(path).replace(/^knowledge_base\//, "");
                    const response = await fetch("knowledge_base/" + cleanPath, { cache: "no-store" });
                    if (!response.ok) continue;
                    const data = await response.json();
                    this.stats.files += 1;
                    this.sources.push(cleanPath);

                    const records = Array.isArray(data)
                        ? data
                        : Array.isArray(data?.cases) ? data.cases
                        : Array.isArray(data?.entities) ? data.entities
                        : [];

                    records.forEach((item, index) => {
                        const adapted = this.adaptRecord(item, cleanPath, index);
                        if (adapted) this.cases.push(adapted);
                    });
                } catch (error) {
                    console.warn("Fonte de conhecimento indisponível:", path, error);
                }
            }

            this.stats.records = this.cases.length;
            this.stats.playable = this.cases.length;
            console.info("Knowledge Base universal carregada:", this.stats, this.sources);
            return this;
        }

        random() {
            if (!this.cases.length) return null;
            return structuredClone(this.cases[Math.floor(Math.random() * this.cases.length)]);
        }
    }
    class DiagnosisEngine {
        constructor() {
            const params = new URLSearchParams(location.search);
            this.room = params.get("sala") || CONFIG.defaultRoom;
            this.elements = {};
            this.library = new CaseLibrary();
            this.currentCase = null;
            this.patientState = null;
            this.research = null;
            this.researchRules = null;
            this.referenceRanges = null;
            this.pcdtCatalog = null;
            this.pendingResearch = false;
            this.score = 0;
            this.errors = 0;
            this.hints = 0;
            this.time = 0;
            this.conversationLogger = null;
            this.context = this.createContext();
        }

        createContext() {
            return {
                phase: "investigation",
                revealed: new Set(),
                history: [],
                time: 0,
                score: 0,
                errors: 0,
                startedAt: Date.now(),
                hypothesis: {
                    text: "",
                    locked: false,
                    submittedAt: null,
                    elapsedSeconds: null,
                    similarity: null,
                    score: null,
                    evaluated: false
                }
            };
        }

        syncCompatibilityState() {
            this.score = Number(this.context?.score || 0);
            this.errors = Number(this.context?.errors || 0);
            this.time = Number(this.context?.time || 0);
            this.setText("score", this.score);
        }

        async boot() {
            this.bindUI();
            this.setText("roomLabel", this.room === "vermelha" ? "Sala Vermelha" : "Sala Clínica");
            this.setText("roomLabelMeta", this.room === "vermelha" ? "Sala Vermelha" : "Sala Clínica");
            await this.loadModules();
            // The legacy CaseLibrary is compatibility-only. The first playable
            // cases are now generated by CasePreparationEngine from the Knowledge Base.
            // Do not block clinical generation on the old library.
            this.library.sources = [];
            this.library.cases = [];
            this.library.stats = { files: 0, records: 0, playable: 0 };
            await this.loadResearchRules();
            await this.loadPCDTCatalog();
            await this.loadReferenceRanges();
            this.conversationLogger?.logEvent("engine_booted", { room: this.room, case_generation: "knowledge_driven" });
        }

        async ensureGeminiConversationProvider() {
            if (global.DiagnosysGeminiConversationProvider) return true;
            try {
                await loadScript("Js/core/gemini-conversation-provider.js");
                return Boolean(global.DiagnosysGeminiConversationProvider);
            } catch (error) {
                console.warn("Gemini de conversação indisponível até o momento:", error);
                return false;
            }
        }

        async ensureGeminiResearchProvider() {
            if (global.DiagnosysGeminiProvider) return true;
            try {
                await loadScript("Js/core/gemini-research-provider.js");
                return Boolean(global.DiagnosysGeminiProvider);
            } catch (error) {
                console.warn("Gemini de pesquisa indisponível até o momento:", error);
                return false;
            }
        }

        async loadModules() {
            try { await loadScript("Js/core/symptom-characterization.js"); } catch (e) { console.warn(e); }
            try { await loadScript("Js/core/case-builder.js"); } catch (e) { console.warn(e); }
            try { await loadScript("Js/core/knowledge-base-adapter.js"); } catch (e) { console.warn(e); }
            try { await loadScript("Js/core/knowledge-to-patient-engine.js"); } catch (e) { console.warn(e); }
            try { await loadScript("Js/core/case-research-engine.js"); } catch (e) { console.warn(e); }
            try { await loadScript("Js/core/pcdt-catalog-provider.js"); } catch (e) { console.warn(e); }
            try { await loadScript("Js/core/reference-range-resolver.js"); } catch (e) { console.warn(e); }
            try { await loadScript("conversation/conversation-logger.js"); } catch (e) { console.warn(e); }
            if (global.AuroraConversationLogger) {
                this.conversationLogger = new global.AuroraConversationLogger({ application: "Diagnosys" });
            }
        }

        async loadResearchRules() {
            try {
                const response = await fetch(CONFIG.researchRules, { cache: "no-store" });
                if (response.ok) this.researchRules = await response.json();
            } catch (error) {
                console.warn("Regras de pesquisa externa indisponíveis:", error);
            }
        }

        async loadPCDTCatalog() {
            try {
                const response = await fetch(CONFIG.pcdtCatalog, { cache: "no-store" });
                if (response.ok) this.pcdtCatalog = await response.json();
            } catch (error) {
                console.warn("Catálogo PCDT indisponível:", error);
            }
        }

        async loadReferenceRanges() {
            try {
                const response = await fetch("knowledge_base/reference_ranges.json", { cache: "no-store" });
                if (response.ok) this.referenceRanges = await response.json();
            } catch (error) {
                console.warn("Tabela de referências indisponível:", error);
            }
        }

        bindUI() {
            this.elements = {
                title: document.getElementById("caseTitle"),
                intro: document.getElementById("caseIntro"),
                log: document.getElementById("clinicalLog"),
                input: document.getElementById("actionInput"),
                send: document.getElementById("sendBtn"),
                hint: document.getElementById("hintBtn"),
                science: document.getElementById("scienceBtn"),
                next: document.getElementById("nextBtn"),
                back: document.getElementById("backBtn"),
                stateList: document.getElementById("stateList"),
                investigationCatalog: document.getElementById("investigationCatalog"),
                hypothesisInput: document.getElementById("hypothesisInput"),
                hypothesisSubmit: document.getElementById("hypothesisSubmit"),
                hypothesisStatus: document.getElementById("hypothesisStatus"),
                geminiTest: document.getElementById("geminiTest"),
                geminiDiagnostic: document.getElementById("geminiDiagnostic"),
                conversationLogDownload: document.getElementById("conversationLogDownload"),
                fc: document.getElementById("fc"),
                rr: document.getElementById("rr"),
                spo2: document.getElementById("spo2"),
                pa: document.getElementById("pa"),
                temp: document.getElementById("temp"),
                glucose: document.getElementById("glucose")
            };

            this.elements.send?.addEventListener("click", () => this.submit());
            this.elements.input?.addEventListener("keydown", event => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    this.submit();
                }
            });
            this.elements.next?.addEventListener("click", () => this.startNewCase());
            // Scientific Base owns its own button listener; keeping a single owner avoids duplicate research calls.
            this.elements.hint?.addEventListener("click", () => this.showHint());
            this.elements.hypothesisSubmit?.addEventListener("click", () => this.submitHypothesis());
            this.elements.geminiTest?.addEventListener("click", () => this.testGeminiConnection());
            this.elements.conversationLogDownload?.addEventListener("click", () => this.downloadConversationLog());
            this.elements.hypothesisInput?.addEventListener("keydown", event => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    this.submitHypothesis();
                }
            });
            this.elements.back?.addEventListener("click", () => this.log("SISTEMA", "Não há uma etapa anterior disponível neste caso."));
        }

        activatePreparedCase(clinicalCase) {
            if (!clinicalCase) throw new Error("Nenhum caso clínico preparado.");
            this.context = this.createContext();
            this.score = 0;
            this.errors = 0;
            this.time = 0;
            this.clearLog();
            this.research = clinicalCase.evidence || null;
            this.pendingResearch = false;
            this.pendingClinicalChallenge = null;
            this.currentCase = clinicalCase;
            this.startConversationSession?.(clinicalCase);
            this.patientState = this.createPatientState(clinicalCase);
            this.renderInitialCase();
            this.renderHypothesis();
            this.log("SISTEMA", "Paciente clínico carregado a partir da Knowledge Base. O diagnóstico permanece oculto.");
            if (this.elements?.input) this.elements.input.disabled = false;
            if (this.elements?.send) this.elements.send.disabled = false;
            return clinicalCase;
        }

        async startNewCase() {
            const queued = Array.isArray(this.__backgroundPreparedCases) && this.__backgroundPreparedCases.length
                ? this.__backgroundPreparedCases.shift()
                : null;

            if (queued?.case) {
                return this.activatePreparedCase(queued.case);
            }

            if (this.__casePreparation?.prepareFirst) {
                const first = await this.__casePreparation.prepareFirst();
                return this.activatePreparedCase(first.case);
            }

            throw new Error("Nenhum caso preparado está disponível.");
        }

        async buildCase(sourceCase) {
            let evidence = { enabled: false, evidence: [] };

            if (global.CaseResearchEngine && this.researchRules) {
                try {
                    const researcher = new global.CaseResearchEngine({
                    config: this.researchRules,
                    provider: global.DiagnosysResearchProvider || null
                });
                    evidence = await researcher.research(sourceCase);
                } catch (error) {
                    console.warn("Pesquisa externa durante geração falhou:", error);
                }
            }

            if (global.CaseBuilder) {
                try {
                    return new global.CaseBuilder({ caseSource: sourceCase, research: evidence }).build();
                } catch (error) {
                    console.warn("CaseBuilder falhou; usando caso local:", error);
                }
            }

            return this.normalizeCase(sourceCase, evidence);
        }

        normalizeCase(source, research) {
            return {
                case_id: source.id || `case_${Date.now()}`,
                title: source.title || source.primary_concept || "Caso clínico",
                difficulty: source.difficulty || "Simulação clínica",
                patient: source.patient || source.demographics || {},
                presentation: {
                    chief_complaint: source.opening || source.presentation?.chief_complaint || "",
                    initial_narrative: source.opening || "",
                    vitals: source.physical_exam?.vitals || {}
                },
                initial_state: { stability: "stable" },
                history: source.history || {},
                physical_exam: source.physical_exam || {},
                investigations: {
                    initial: source.initial_cbc || null,
                    available: source.propedeutics || []
                },
                management: source.possible_actions || [],
                evolution: source.temporal_evolution || [],
                hidden: {
                    diagnosis: source.primary_concept || source.title || null,
                    differential: source.differential || []
                },
                evidence: research?.evidence || [],
                educational: source.educational || {}
            };
        }

        createPatientState(caseData) {
            const engine = this;
            const state = {
                diagnosis: caseData.hidden?.diagnosis || null,
                history: caseData.history || {},
                physical_exam: caseData.physical_exam || {},
                investigations: caseData.investigations || {},
                management: caseData.management || {},
                evolution: caseData.evolution || {},
                revealed: {},
                findings: [],
                records: [],
                clinicalChallenges: [],
                stability: caseData.initial_state?.stability || "stable",

                // Compatibility API used by the legacy clinical-enhancement layer.
                advanceTime(type) {
                    const increments = { investigation: 5, examination: 2, history: 1, treatment: 2, default: 1 };
                    const delta = increments[type] ?? increments.default;
                    engine.context.time += delta;
                    engine.syncCompatibilityState();
                    return engine.context.time;
                },

                addFinding(finding) {
                    this.findings = this.findings || [];
                    this.findings.push(finding);
                    return finding;
                },

                record(entry) {
                    this.records = this.records || [];
                    this.records.push(entry);
                    return entry;
                }
            };

            return state;
        }

        renderInitialCase() {
            const c = this.currentCase;
            const patient = c.patient || {};
            const p = c.presentation || {};
            const vitals = p.vitals || {};
            const rawHeartRate = vitals.HR || vitals.fc || c.vitals?.HR || c.vitals?.fc;
            const rawRhythm = vitals.rhythm || vitals.ritmo || c.vitals?.rhythm || c.vitals?.ritmo;
            const heartRate = rawHeartRate || "72 bpm";
            const rhythm = rawRhythm || "sinusal";
            const age = patient.age != null ? `${patient.age} anos` : "idade não informada";
            const sex = this.sexLabel(patient.sex);

            this.setText("caseTitle", "Novo paciente");
            this.setText("difficultyLabel", c.difficulty || "Simulação clínica");
            this.setText("caseIntro", p.initial_narrative || this.composeNarrative(c));
            this.setText("fc", heartRate);
            this.setText("rhythm", rhythm);
            this.setText("rr", vitals.RR || vitals.fr || "--");
            this.setText("spo2", vitals.SpO2 || vitals.spo2 || "--");
            this.setText("pa", vitals.BP || vitals.pa || "--");
            this.setText("temp", vitals.temperature || vitals.temp || "--");
            this.setText("glucose", vitals.glucose || "--");

            this.renderState(age, sex);
            this.renderHypothesis();
            this.log("PACIENTE", `Paciente ${sex.toLowerCase()}, ${age}, chega para avaliação.`);
            this.log("PACIENTE", `Queixa principal: ${p.chief_complaint || "não informada"}`);
        }

        composeNarrative(c) {
            const p = c.patient || {};
            const complaint = c.presentation?.chief_complaint || "procura atendimento médico";
            return `${this.sexLabel(p.sex)}, ${p.age ?? "idade não informada"} anos, ${complaint}.`;
        }

        sexLabel(value) {
            const n = normalize(value);
            if (n === "female" || n === "feminino" || n === "f") return "Mulher";
            if (n === "male" || n === "masculino" || n === "m") return "Homem";
            return "Paciente";
        }

        async submit() {
            const input = this.elements.input?.value.trim();
            if (!input) return;
            this.elements.input.value = "";
            this.log("MÉDICO", input);
            this.conversationLogger?.logEvent("action_submitted", { phase: this.context?.phase || null });
            await this.processAction(input);
        }

        async processAction(input) {
            const n = normalize(input);
            this.context.history.push(input);
            this.conversationLogger?.logEvent("action_processing_started", { phase: this.context?.phase || null });

            if (/^(base cientifica|pesquisa|busca cientifica|buscar evidencia|procure na literatura)/.test(n)) {
                this.conversationLogger?.logEvent("intent_detected", { intent: "scientific_research" });
                await this.researchOnDemand(input);
                return;
            }

            if (this.isReferenceQuestion(n)) {
                this.conversationLogger?.logEvent("intent_detected", { intent: "reference_question" });
                this.answerReferenceQuestion(input);
                return;
            }

            const physicalAnswer = this.queryPatientState(input);
            if (physicalAnswer) {
                this.context.time += 1;
                this.syncCompatibilityState();
                this.log("PACIENTE", physicalAnswer);
                this.renderState();
                this.conversationLogger?.logEvent("local_patient_response", { source: "local_patient_state" });
                return;
            }

            const exam = this.matchInvestigation(input);
            if (exam) {
                this.conversationLogger?.logEvent("intent_detected", { intent: "investigation", investigation: exam.name });
                this.revealInvestigation(exam);
                return;
            }

            if (/^(diagnostico|minha hipotese|suspeito|penso em)/.test(n) || /\b(e uma possivel causa|e uma possibilidade|pode ser|poderia ser|uma causa possivel|hipotese)\b/.test(n)) {
                this.conversationLogger?.logEvent("intent_detected", { intent: "diagnostic_hypothesis" });
                this.log("SISTEMA", "Hipótese registrada. Continue a investigação ou conduza o manejo conforme o estado clínico.");
                this.context.phase = "diagnosis";
                return;
            }

            // Gemini é uma camada opcional. O fluxo clínico local não depende dele
            // e não o chama automaticamente quando uma frase não é reconhecida.
            // A ativação ocorre somente por uma ação explícita (teste/recurso extra).
            this.context.errors += 1;
            this.syncCompatibilityState();
            this.conversationLogger?.logEvent("local_fallback", { reason: "no_clinical_action_matched" });
            this.log("SISTEMA", "Não encontrei uma ação clínica específica para essa frase. Tente perguntar sobre história, exame físico ou solicitar um exame disponível.");
        }

        async testGeminiConnection() {
            const root = this.elements.geminiDiagnostic;
            const button = this.elements.geminiTest;
            const endpoint = CONFIG.geminiWorkerUrl.replace("/api/gemini/research", "/api/gemini/conversation");
            const startedAt = performance.now();

            const render = (html) => {
                if (root) root.innerHTML = html;
            };
            const row = (ok, label, detail) =>
                '<div class="gemini-diag-row">' +
                    '<span class="gemini-diag-dot ' + (ok ? "ok" : "bad") + '"></span>' +
                    '<span class="gemini-diag-label">' + escapeHTML(label) + '</span>' +
                    '<span class="gemini-diag-detail">' + escapeHTML(detail || "") + '</span>' +
                '</div>';

            if (button) button.disabled = true;

            // O provider só é carregado porque o usuário pediu explicitamente
            // para testar o Gemini. Nunca durante o boot ou uma ação clínica comum.
            const providerReady = await this.ensureGeminiConversationProvider();
            render(
                row(true, "Frontend", "teste iniciado") +
                row(providerReady, "Provider", providerReady ? "carregado por solicitação explícita" : "não carregado")
            );

            let workerOk = false;
            let workerDetail = "não verificado";
            let workerMeta = null;

            try {
                const healthResponse = await fetch(endpoint.replace("/api/gemini/conversation", "/"), {
                    method: "GET",
                    headers: { "Accept": "application/json" },
                    cache: "no-store"
                });
                const healthText = await healthResponse.text();
                let healthData = null;
                try { healthData = JSON.parse(healthText); } catch {}
                workerOk = healthResponse.ok && healthData?.ok === true;
                workerMeta = healthData;
                workerDetail = workerOk
                    ? "HTTP " + healthResponse.status + " · " + (healthData?.service || "Worker ativo")
                    : "HTTP " + healthResponse.status + " · " + (healthData?.error || "resposta inválida");
            } catch (error) {
                workerDetail = error instanceof Error ? error.message : String(error);
            }

            if (!providerReady || !global.DiagnosysGeminiConversationProvider) {
                render(
                    row(true, "Frontend", "botão executado") +
                    row(false, "Provider", "não disponível") +
                    row(workerOk, "Cloudflare Worker", workerDetail) +
                    row(false, "Gemini API", "não testada") +
                    row(false, "JSON", "não testado")
                );
                if (button) button.disabled = false;
                return;
            }

            let apiOk = false;
            let jsonOk = false;
            let apiDetail = "não verificado";
            let jsonDetail = "não verificado";

            try {
                const provider = new global.DiagnosysGeminiConversationProvider({
                    endpoint,
                    timeoutMs: 30000
                });

                const response = await provider.respond({
                    question: "Responda exatamente GEMINI_OK",
                    case: {
                        case_id: "gemini_diagnostic",
                        patient: { age: 40, sex: "masculino" },
                        presentation: { chief_complaint: "teste de conectividade", initial_narrative: "Teste técnico do Diagnosys." },
                        history: {},
                        symptom_characterization: {},
                        clinical_symptoms: {},
                        risk_factors: [],
                        physical_exam: {},
                        revealed_investigations: {},
                        monitoring: { active: false, alerts: [] },
                        care_mode: "diagnostic",
                        conversation: []
                    }
                });

                apiOk = response?.ok === true && typeof response?.response === "string";
                jsonOk = apiOk && response.response.trim().length > 0;
                apiDetail = apiOk
                    ? "resposta recebida · " + (response.model || workerMeta?.model_default || "modelo informado pelo Worker")
                    : "Worker respondeu sem contrato válido";
                jsonDetail = jsonOk
                    ? "contrato de conversa válido · resposta: " + response.response.trim().slice(0, 80)
                    : "resposta ausente ou inválida";

                render(
                    row(true, "Frontend", "botão executado") +
                    row(true, "Provider", "classe carregada") +
                    row(workerOk, "Cloudflare Worker", workerDetail) +
                    row(apiOk, "Gemini API", apiDetail) +
                    row(jsonOk, "JSON", jsonDetail) +
                    '<div class="gemini-diag-success">🟢 GEMINI_OK · ' + escapeHTML(response.response.trim()) + '</div>' +
                    '<div class="gemini-diag-meta">Endpoint: ' + escapeHTML(endpoint) + ' · Latência: ' + Math.round(performance.now() - startedAt) + ' ms</div>'
                );

                this.log("GEMINI", "Diagnóstico concluído: conexão Gemini operacional.");
            } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                render(
                    row(true, "Frontend", "botão executado") +
                    row(true, "Provider", "classe carregada") +
                    row(workerOk, "Cloudflare Worker", workerDetail) +
                    row(false, "Gemini API", detail) +
                    row(false, "JSON", "não validado") +
                    '<div class="gemini-diag-error">🔴 Falha detectada: ' + escapeHTML(detail) + '</div>' +
                    '<div class="gemini-diag-meta">Endpoint: ' + escapeHTML(endpoint) + ' · Latência: ' + Math.round(performance.now() - startedAt) + ' ms</div>'
                );
                this.log("GEMINI", "Diagnóstico falhou: " + detail);
            } finally {
                if (button) button.disabled = false;
            }
        }

        async converseWithPatient(question) {
            const c = this.currentCase || {};
            const revealed = {};
            const catalog = Array.isArray(c.investigations?.catalog) ? c.investigations.catalog : [];
            for (const item of catalog) {
                const id = item?.id;
                if (id && this.context?.revealed?.has(id)) {
                    revealed[id] = {
                        name: item.name || item.exam || id,
                        result: item.result,
                        interpretation: item.interpretation || null
                    };
                }
            }

            const provider = new global.DiagnosysGeminiConversationProvider({
                endpoint: CONFIG.geminiWorkerUrl.replace("/api/gemini/research", "/api/gemini/conversation")
            });

            const truth = c.clinical_truth || {};
            const visibleCase = {
                case_id: c.case_id || c.id || null,
                patient: c.patient || {},
                presentation: c.presentation || {},
                history: c.history || {},
                symptom_characterization: truth.symptom_characterization || {},
                clinical_symptoms: truth.symptoms || {},
                risk_factors: truth.risk_factors || [],
                physical_exam: c.physical_exam || {},
                revealed_investigations: revealed,
                monitoring: this.context?.clinicalFlow?.monitoring || { active: false, alerts: [] },
                care_mode: c.initial_state?.care_mode || null,
                conversation: (this.context.history || []).slice(-10)
            };

            const response = await provider.respond({
                question,
                case: visibleCase
            });

            return response?.response || response?.result?.response || "";
        }

        hypothesisSimilarity(text) {
            const hidden = this.currentCase?.hidden || {};
            const candidates = [
                hidden.diagnosis,
                hidden.label
            ].filter(Boolean).map(value => normalize(value));

            const value = normalize(text);
            if (!value || !candidates.length) return 0;

            const tokens = value.split(" ").filter(Boolean);
            const tokenSet = new Set(tokens);

            const similarityFor = target => {
                if (!target) return 0;
                if (value === target) return 1;
                if (tokens.length >= 2 && (target.includes(value) || value.includes(target))) return 0.85;

                const targetTokens = target.split(" ").filter(Boolean);
                const targetSet = new Set(targetTokens);
                const intersection = [...tokenSet].filter(token => targetSet.has(token)).length;
                const union = new Set([...tokenSet, ...targetSet]).size;
                const jaccard = union ? intersection / union : 0;

                const distance = this.levenshtein(value, target);
                const maxLength = Math.max(value.length, target.length, 1);
                const editSimilarity = 1 - (distance / maxLength);

                return intersection > 0
                    ? Math.max(jaccard, editSimilarity * 0.8)
                    : jaccard;
            };

            return Math.max(...candidates.map(similarityFor), 0);
        }

        levenshtein(a, b) {
            const previous = Array.from({ length: b.length + 1 }, (_, i) => i);

            for (let i = 1; i <= a.length; i += 1) {
                const current = [i];

                for (let j = 1; j <= b.length; j += 1) {
                    const insert = current[j - 1] + 1;
                    const remove = previous[j] + 1;
                    const replace = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
                    current.push(Math.min(insert, remove, replace));
                }

                for (let j = 0; j < current.length; j += 1) previous[j] = current[j];
            }

            return previous[b.length];
        }

        submitHypothesis() {
            const state = this.context?.hypothesis;

            if (!state || state.locked) return;

            const input = this.elements.hypothesisInput?.value.trim();
            if (!input) {
                this.setText("hypothesisStatus", "Digite uma hipótese antes de fixá-la.");
                return;
            }

            state.text = input;
            state.locked = true;
            state.submittedAt = Date.now();
            state.elapsedSeconds = Math.max(0, (state.submittedAt - state.startedAt) / 1000);
            state.similarity = this.hypothesisSimilarity(input);
            state.evaluated = false;

            this.context.phase = "diagnosis";
            this.syncCompatibilityState();
            this.renderHypothesis();
            this.log(
                "HIPÓTESE",
                "Hipótese diagnóstica fixada. Ela não poderá mais ser alterada neste caso; a pontuação será revelada no encerramento."
            );
        }

        finalizeHypothesis() {
            const state = this.context?.hypothesis;
            if (!state || state.evaluated) return state || null;

            if (!state.locked) {
                state.evaluated = true;
                state.score = 0;
                state.similarity = 0;
                this.__lastHypothesisResult = {
                    score: 0,
                    similarity: 0,
                    elapsedSeconds: Math.max(0, (Date.now() - (state.startedAt || Date.now())) / 1000),
                    text: "",
                    target: this.currentCase?.hidden?.label || this.currentCase?.hidden?.diagnosis || null,
                    registered: false
                };
                return this.__lastHypothesisResult;
            }

            const elapsed = Math.max(0, state.elapsedSeconds || 0);
            const speedFactor = Math.max(0.2, 1 - (elapsed / 600));
            const similarity = Math.max(0, Math.min(1, Number(state.similarity || 0)));
            const score = Math.round(100 * similarity * speedFactor);

            state.score = score;
            state.evaluated = true;
            this.context.score += score;
            this.syncCompatibilityState();

            this.__lastHypothesisResult = {
                score,
                similarity,
                elapsedSeconds: elapsed,
                text: state.text,
                target: this.currentCase?.hidden?.label || this.currentCase?.hidden?.diagnosis || null,
                registered: true
            };

            this.log(
                "RESULTADO",
                `Hipótese encerrada: ${score}/100. Tempo até fixação: ${Math.round(elapsed)} s. Proximidade: ${Math.round(similarity * 100)}%.`
            );
            this.renderHypothesis();
            this.renderState();

            return this.__lastHypothesisResult;
        }

        renderHypothesis() {
            const state = this.context?.hypothesis;
            const input = this.elements.hypothesisInput;
            const button = this.elements.hypothesisSubmit;
            const status = this.elements.hypothesisStatus;

            if (!state || !input || !button || !status) return;

            input.value = state.text || "";
            input.disabled = Boolean(state.locked);
            button.disabled = Boolean(state.locked);

            if (state.locked) {
                status.textContent = state.evaluated
                    ? `Encerrada: ${state.score}/100`
                    : "Hipótese fixada. Continue a investigação; a pontuação aparece ao encerrar o caso.";
                return;
            }

            const elapsed = Math.max(0, (Date.now() - (state.startedAt || Date.now())) / 1000);
            status.textContent = `Hipótese ainda não fixada · ${Math.round(elapsed)} s desde o início`;
        }

        queryPatientState(input) {
            const n = normalize(input);
            const h = this.currentCase.history || {};
            const pe = this.currentCase.physical_exam || {};

            if (/idade|quantos anos/.test(n)) return `Tenho ${this.currentCase.patient?.age ?? "idade não informada"} anos.`;
            if (/sexo|homem|mulher/.test(n)) return `Sou ${this.sexLabel(this.currentCase.patient?.sex).toLowerCase()}.`;
            if (/ha quanto tempo|quanto tempo|desde quando|quando comecou|inicio dos sintomas|comecaram/.test(n)) {
                const duration = h.duration || h.onset || h.time_course || h.tempo_evolucao;
                if (duration) return `Os sintomas começaram há ${Array.isArray(duration) ? duration.join(", ") : duration}.`;
            }
            if (/exame fisico|exame clinico|ao exame/.test(n)) return this.formatExam(pe);

            const termMap = [
                ["ictericia|icterico|icterica", "icterícia"],
                ["palidez|palido|palida", "palidez"],
                ["sangramento|sangra|sangue", "sangramento"],
                ["melena|fezes negras|fezes escurecidas", "melena"],
                ["pica", "pica"],
                ["glossite", "glossite"],
                ["queilite", "queilite angular"],
                ["edema|inchaco|inchada|inchado", "edema"],
                ["dor", "dor"]
            ];

            for (const [pattern, label] of termMap) {
                if (new RegExp(pattern).test(n)) {
                    const found = this.findClinicalTerm(label, h, pe);
                    if (found != null) {
                        return found
                            ? `Sim. Há ${label} no caso.`
                            : `Não. Não há ${label} registrado no caso.`;
                    }
                }
            }

            if (/historia|historico|antecedente|comorbidade|hda/.test(n)) return this.formatHistory(h);
            if (/sintoma|sente|sentindo|queixa/.test(n)) return `A queixa inicial é: ${this.currentCase.presentation?.chief_complaint || "não informada"}.`;

            return null;
        }

        findClinicalTerm(label, history, physical) {
            const target = normalize(label);
            const text = normalize(JSON.stringify({ history, physical }));

            // Evaluate explicit negative statements before generic presence.
            const aliases = {
                "icterícia": ["ictericia", "icterico", "icterica"],
                "palidez": ["palidez", "palido", "palida"],
                "sangramento": ["sangramento", "sangra"],
                "melena": ["melena", "fezes negras", "fezes escurecidas"],
                "pica": ["pica"],
                "glossite": ["glossite"],
                "queilite angular": ["queilite angular", "queilite"],
                "edema": ["edema", "inchaco", "inchada", "inchado"],
                "dor": ["dor"]
            };
            const candidates = aliases[label] || [target];
            const negativePrefixes = ["sem", "nega", "nao apresenta", "nao ha", "nao tem", "ausencia de"];

            for (const candidate of candidates) {
                for (const prefix of negativePrefixes) {
                    if (text.includes(`${prefix} ${candidate}`)) return false;
                }
            }

            for (const candidate of candidates) {
                if (text.includes(candidate)) return true;
            }

            return null;
        }

        formatExam(exam) {
            const vitals = exam.vitals || {};
            const findings = flatten(exam.findings || []).map(item => typeof item === "string" ? item : JSON.stringify(item));
            const vitalText = Object.entries(vitals).map(([k, v]) => `${k}: ${v}`).join("; ");
            return `Ao exame: ${vitalText || "sinais vitais não informados"}. ${findings.length ? "Achados: " + findings.join("; ") + "." : "Nenhum achado adicional registrado."}`;
        }

        formatHistory(history) {
            const parts = [];
            for (const [key, value] of Object.entries(history || {})) {
                if (Array.isArray(value)) parts.push(`${key}: ${value.join(", ")}`);
                else if (value != null && typeof value !== "object") parts.push(`${key}: ${value}`);
            }
            return parts.length ? parts.join("; ") + "." : "A história detalhada ainda não foi registrada.";
        }

        renderInvestigationCatalog() {
            const root = this.elements.investigationCatalog;
            if (!root) return;

            const catalog = Array.isArray(this.currentCase?.investigations?.catalog)
                ? this.currentCase.investigations.catalog
                : [];

            if (!catalog.length) {
                root.innerHTML = `<div class="investigation-empty">Nenhuma investigação disponível neste cenário.</div>`;
                return;
            }

            root.innerHTML = catalog
                .filter(item => item && item.available !== false)
                .map(item => {
                    const id = escapeHTML(item.id || item.exam || item.name || "");
                    const name = escapeHTML(item.name || item.exam || item.id || "Exame");
                    const performed = this.context?.revealed?.has(item.id);
                    return `
                        <button type="button"
                                class="investigation-chip ${performed ? "performed" : ""}"
                                data-investigation-id="${id}">
                            <span class="investigation-chip-name">${name}</span>
                            <span class="investigation-chip-status">${performed ? "resultado revelado" : "disponível"}</span>
                        </button>
                    `;
                })
                .join("");

            root.querySelectorAll("[data-investigation-id]").forEach(button => {
                button.addEventListener("click", () => {
                    const id = button.dataset.investigationId;
                    const item = catalog.find(entry => String(entry.id || entry.exam || entry.name) === id);
                    if (item) {
                        this.revealInvestigation({
                            id: item.id || item.exam || item.name,
                            name: item.name || item.exam || item.id,
                            result: item.result,
                            interpretation: item.interpretation || null
                        });
                    }
                });
            });
        }

        matchInvestigation(input) {
            const n = normalize(input);
            const catalog = Array.isArray(this.currentCase?.investigations?.catalog)
                ? this.currentCase.investigations.catalog
                : [];

            for (const item of catalog) {
                if (!item || item.available === false) continue;
                const name = normalize(item.exam || item.name || item.id);
                if (!name) continue;

                if (
                    n.includes(name) ||
                    (name === "hemograma" && /cbc|hemograma completo|complete blood count/.test(n))
                ) {
                    return {
                        id: item.id || item.exam || item.name,
                        name: item.name || item.exam || item.id,
                        result: item.result,
                        interpretation: item.interpretation || null
                    };
                }
            }

            return null;
        }

        revealInvestigation(exam) {
            if (!exam || exam.result === undefined || exam.result === null || exam.result === "") {
                this.log("SISTEMA", `A investigação ${exam?.name || "solicitada"} não possui resultado definido no caso e não pode ser revelada.`);
                return;
            }

            if (this.context.revealed.has(exam.id)) {
                this.log("RESULTADO", `${exam.name} já foi realizado neste caso.`);
                return;
            }

            this.context.time += 5;
            this.context.revealed.add(exam.id);
            this.patientState.revealed = this.patientState.revealed || {};
            this.patientState.revealed[exam.id] = exam.result;
            this.patientState.investigations = this.patientState.investigations || {};
            this.patientState.investigations[exam.id] = {
                requested: true,
                performed: true,
                result: exam.result,
                timestamp: Date.now()
            };
            this.patientState.record?.({
                type: "investigation",
                target: exam.id,
                result: exam.result,
                timestamp: Date.now()
            });
            this.syncCompatibilityState();
            this.log("INVESTIGAÇÃO", `${exam.name} solicitado.`);
            this.log("RESULTADO", this.formatInvestigationResult(exam));
            this.renderState();
        }

        formatInvestigationResult(exam) {
            if (!exam || exam.result === undefined || exam.result === null) {
                return "Resultado não definido.";
            }

            if (exam.id === "initial_cbc" && typeof exam.result === "object") {
                const labels = {
                    hemoglobin_g_dl: "Hemoglobina",
                    hematocrit_percent: "Hematócrito",
                    rbc_million_per_mm3: "Hemácias",
                    mcv_fl: "VCM",
                    mch_pg: "HCM",
                    mchc_g_dl: "CHCM",
                    rdw_percent: "RDW",
                    wbc_per_mm3: "Leucócitos",
                    platelets_per_mm3: "Plaquetas",
                    reticulocytes_percent: "Reticulócitos"
                };
                return Object.entries(exam.result)
                    .map(([key, value]) => `${labels[key] || key}: ${value}`)
                    .join(" | ");
            }

            if (typeof exam.result === "object") {
                const valueText = Object.entries(exam.result)
                    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
                    .join(" | ");
                return `${valueText}${exam.interpretation ? ` — ${exam.interpretation}` : ""}`;
            }

            return `${exam.result}${exam.interpretation ? ` — ${exam.interpretation}` : ""}`;
        }

        isReferenceQuestion(n) {
            return /valor de referencia|valores de referencia|normal|faixa de referencia/.test(n);
        }

        answerReferenceQuestion(input) {
            const n = normalize(input);
            const terms = ["hemoglobina", "hematocrito", "vcm", "hcm", "chcm", "rdw", "leucocitos", "plaquetas", "creatinina", "sodio", "potassio", "glicemia", "tsh"];
            const term = terms.find(item => n.includes(item));
            if (global.ReferenceRangeResolver && term) {
                const resolver = new global.ReferenceRangeResolver(this.referenceRanges || {});
                const result = resolver.get(term, { age: this.currentCase.patient?.age, sex: this.currentCase.patient?.sex });
                if (result) {
                    this.log("REFERÊNCIA", `${result.name}: ${typeof result.reference === "string" ? result.reference : JSON.stringify(result.reference)} ${result.unit || ""}.`);
                    return;
                }
            }
            this.log("REFERÊNCIA", "Consulte a tabela de valores de referência disponível no sistema; os intervalos podem variar conforme laboratório, método, idade e sexo.");
        }

        async researchOnDemand(reason) {
            if (this.pendingResearch) return;
            this.pendingResearch = true;
            this.log("PESQUISA", "Consultando a camada de evidências configurada...");
            try {
                if (!global.CaseResearchEngine || !this.researchRules) {
                    this.log("PESQUISA", "O gatilho está instalado, mas o conector externo ainda não está disponível nesta execução.");
                    return;
                }
                const researchReady = await this.ensureGeminiResearchProvider();
                const researcher = new global.CaseResearchEngine({
                    config: this.researchRules,
                    provider: researchReady ? global.DiagnosysGeminiProvider : null
                });
                const concept = this.currentCase.hidden?.label
                    || this.currentCase.hidden?.diagnosis
                    || this.currentCase.title
                    || "condição clínica";

                const catalogResearch = await researcher.research({
                    concept,
                    primary_concept: concept,
                    anchors: [reason]
                });

                this.research = catalogResearch || { enabled: true, evidence: [], source_status: [] };

                if (researchReady && global.DiagnosysGeminiProvider) {
                    try {
                        const gemini = new global.DiagnosysGeminiProvider({ endpoint: CONFIG.geminiWorkerUrl });
                        const response = await gemini.research({
                            disease: concept,
                            source: "msd_manuals",
                            topics: [
                                "fisiopatologia",
                                "epidemiologia",
                                "clinica",
                                "exame_fisico",
                                "diagnostico",
                                "diagnostico_diferencial",
                                "tratamento",
                                "complicacoes",
                                "evolucao",
                                "seguimento"
                            ]
                        });

                        this.research.gemini = response?.result || null;
                        this.research.gemini_status = response?.ok ? "ok" : "error";
                        if (response?.ok) {
                            this.log("GEMINI", "Síntese clínica recebida pelo Worker e incorporada à Base Científica.");
                        } else {
                            this.log("GEMINI", "O Worker respondeu, mas a síntese do Gemini não pôde ser incorporada.");
                        }
                    } catch (error) {
                        this.research.gemini_status = "error";
                        this.research.gemini_error = error instanceof Error ? error.message : String(error);
                        this.log("GEMINI", "Não foi possível consultar o Gemini nesta execução.");
                    }
                }

                const count = this.research?.evidence?.length || 0;
                const pcdt = (this.research?.evidence || []).find(item => item.source_id === "ministerio_saude");
                const matches = pcdt?.result?.matches || [];
                this.log(
                    "PESQUISA",
                    count
                        ? count + " registros retornados. PCDT: " + (matches.length ? matches.slice(0, 3).map(item => item.name).join(" | ") : "sem correspondência") + "."
                        : "Nenhuma evidência retornada."
                );
            } finally {
                this.pendingResearch = false;
            }
        }

        showHint() {
            this.hints += 1;
            this.log("DICA", "Comece pela história e pelo exame físico antes de avançar para exames complementares.");
        }

        renderState(age, sex) {
            if (!this.elements.stateList) {
                this.renderInvestigationCatalog();
                return;
            }
            const c = this.currentCase;
            const revealed = [...(this.context?.revealed || [])];
            this.renderInvestigationCatalog();
            this.elements.stateList.innerHTML = [
                `<li>Paciente: ${escapeHTML(sex || (c?.patient?.sex || "--"))}, ${escapeHTML(age || (c?.patient?.age ? c.patient.age + " anos" : "--"))}</li>`,
                `<li>Estabilidade: ${escapeHTML(c?.initial_state?.stability || "--")}</li>`,
                `<li>Tempo clínico: ${this.context?.time || 0} min</li>`,
                `<li>Exames revelados: ${revealed.length}</li>`,
                `<li>Diagnóstico estabelecido: ${this.context?.phase === "diagnosis" ? "sim" : "não"}</li>`
            ].join("");
        }

        render() { this.renderState(); }

        clearLog() { if (this.elements.log) this.elements.log.innerHTML = ""; }

        startConversationSession(caseData = {}) {
            if (!this.conversationLogger) return;
            this.conversationLogger.startSession({
                mode: this.room === "vermelha" ? "sala_vermelha" : "sala_clinica",
                case_id: caseData.case_id || caseData.id || null,
                title: caseData.title || null,
                difficulty: caseData.difficulty || null
            });
        }

        downloadConversationLog() {
            if (!this.conversationLogger) {
                this.log("ERRO", "Logger de conversa não está disponível nesta execução.");
                return;
            }
            this.conversationLogger.logEvent("manual_download_requested", { event_count_before_download: this.conversationLogger.getEventCount() });
            this.conversationLogger.download();
        }

        log(type, message) {
            if (this.conversationLogger) {
                const role = type === "MÉDICO" ? "user" : type === "PACIENTE" ? "assistant" : "system";
                this.conversationLogger.logMessage(role, message, { clinical_type: type });
            }
            const log = this.elements.log || document.getElementById("clinicalLog");
            if (!log) return;
            const entry = document.createElement("div");
            entry.className = "log-entry system";
            entry.innerHTML = `<strong>${escapeHTML(type)}</strong><div>${escapeHTML(message)}</div>`;
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }

        setText(id, value) {
            const element = document.getElementById(id);
            if (element) element.textContent = String(value ?? "");
        }
    }

    global.DiagnosisEngine = DiagnosisEngine;
    global.idmtEngine = new DiagnosisEngine();
    // Boot is intentionally owned by diagnosis-bootstrap.js.
    // The engine defines the clinical runtime; the page bootstrap decides when/how to start it.
})(window);
