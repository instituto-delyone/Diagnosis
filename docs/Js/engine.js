"use strict";

/*
 * Diagnosys — clinical simulation orchestrator.
 *
 * This layer owns the patient truth, case presentation and conversation loop.
 * Knowledge/research/building are delegated to dedicated modules when available.
 */
(function (global) {
    const CONFIG = {
        caseLibraries: [
            "knowledge_base/anemia_clinical_cases_degree_v1.json"
        ],
        theoryLibraries: [
            "knowledge_base/anemia_theory_degree_v1.json"
        ],
        researchRules: "AI/CASE_RESEARCH_RULES.json",
        defaultRoom: "clinica"
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

    async function loadScript(src) {
        if ([...document.scripts].some(script => script.src.endsWith(src))) return;
        await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
            document.head.appendChild(script);
        });
    }

    class CaseLibrary {
        constructor(paths = CONFIG.caseLibraries) {
            this.paths = paths;
            this.cases = [];
            this.theory = [];
        }

        async load() {
            for (const path of this.paths) {
                try {
                    const response = await fetch(path, { cache: "no-store" });
                    if (!response.ok) continue;
                    const data = await response.json();
                    if (Array.isArray(data?.cases)) this.cases.push(...data.cases);
                    else if (Array.isArray(data)) this.cases.push(...data);
                } catch (error) {
                    console.warn("Biblioteca de casos indisponível:", path, error);
                }
            }

            for (const path of CONFIG.theoryLibraries) {
                try {
                    const response = await fetch(path, { cache: "no-store" });
                    if (!response.ok) continue;
                    this.theory.push(await response.json());
                } catch (error) {
                    console.warn("Biblioteca teórica indisponível:", path, error);
                }
            }
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
            this.pendingResearch = false;
            this.context = {
                phase: "investigation",
                revealed: new Set(),
                history: [],
                time: 0,
                score: 0,
                errors: 0
            };
        }

        async boot() {
            this.bindUI();
            this.setText("roomLabel", this.room === "vermelha" ? "Sala Vermelha" : "Sala Clínica");
            this.setText("roomLabelMeta", this.room === "vermelha" ? "Sala Vermelha" : "Sala Clínica");
            await this.loadModules();
            await this.library.load();
            await this.loadResearchRules();
            await this.loadReferenceRanges();
            await this.startNewCase();
        }

        async loadModules() {
            try { await loadScript("Js/core/case-builder.js"); } catch (e) { console.warn(e); }
            try { await loadScript("Js/core/case-research-engine.js"); } catch (e) { console.warn(e); }
            try { await loadScript("Js/core/reference-range-resolver.js"); } catch (e) { console.warn(e); }
        }

        async loadResearchRules() {
            try {
                const response = await fetch(CONFIG.researchRules, { cache: "no-store" });
                if (response.ok) this.researchRules = await response.json();
            } catch (error) {
                console.warn("Regras de pesquisa externa indisponíveis:", error);
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
            this.elements.science?.addEventListener("click", () => this.researchOnDemand("Base científica solicitada pelo médico."));
            this.elements.hint?.addEventListener("click", () => this.showHint());
            this.elements.back?.addEventListener("click", () => this.log("SISTEMA", "Não há uma etapa anterior disponível neste caso."));
        }

        async startNewCase() {
            this.context = { phase: "investigation", revealed: new Set(), history: [], time: 0, score: 0, errors: 0 };
            this.clearLog();
            this.research = null;
            this.pendingResearch = false;

            const sourceCase = this.library.random();
            if (!sourceCase) {
                this.currentCase = this.createFallbackCase();
            } else {
                this.currentCase = await this.buildCase(sourceCase);
            }

            this.patientState = this.createPatientState(this.currentCase);
            this.renderInitialCase();
            this.log("SISTEMA", "Novo caso clínico carregado. O diagnóstico permanece oculto.");
        }

        async buildCase(sourceCase) {
            let evidence = { enabled: false, evidence: [] };

            if (global.CaseResearchEngine && this.researchRules) {
                try {
                    const researcher = new global.CaseResearchEngine({ config: this.researchRules });
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
            return {
                diagnosis: caseData.hidden?.diagnosis || null,
                history: caseData.history || {},
                physical_exam: caseData.physical_exam || {},
                investigations: caseData.investigations || {},
                management: caseData.management || {},
                evolution: caseData.evolution || {},
                revealed: {},
                stability: caseData.initial_state?.stability || "stable"
            };
        }

        createFallbackCase() {
            return {
                case_id: `fallback_${Date.now()}`,
                title: "Caso clínico",
                difficulty: "Simulação clínica",
                patient: { age: 58, sex: "feminino" },
                presentation: {
                    chief_complaint: "Dor e aumento de volume em membro inferior esquerdo desde ontem.",
                    initial_narrative: "Paciente chega ao pronto-socorro consciente e orientada, referindo dor e edema em membro inferior esquerdo.",
                    vitals: { BP: "138/84 mmHg", HR: "96 bpm", RR: "18 irpm", SpO2: "97%", temperature: "37,2 °C" }
                },
                initial_state: { stability: "stable" },
                history: {}, physical_exam: {}, investigations: {}, management: {}, evolution: {},
                hidden: { diagnosis: "trombose venosa profunda" }, evidence: []
            };
        }

        renderInitialCase() {
            const c = this.currentCase;
            const patient = c.patient || {};
            const p = c.presentation || {};
            const vitals = p.vitals || {};
            const age = patient.age != null ? `${patient.age} anos` : "idade não informada";
            const sex = this.sexLabel(patient.sex);

            this.setText("caseTitle", "Novo paciente");
            this.setText("difficultyLabel", c.difficulty || "Simulação clínica");
            this.setText("caseIntro", p.initial_narrative || this.composeNarrative(c));
            this.setText("fc", vitals.HR || vitals.fc || "--");
            this.setText("rr", vitals.RR || vitals.fr || "--");
            this.setText("spo2", vitals.SpO2 || vitals.spo2 || "--");
            this.setText("pa", vitals.BP || vitals.pa || "--");
            this.setText("temp", vitals.temperature || vitals.temp || "--");
            this.setText("glucose", vitals.glucose || "--");

            this.renderState(age, sex);
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
            await this.processAction(input);
        }

        async processAction(input) {
            const n = normalize(input);
            this.context.history.push(input);

            if (/^(base cientifica|pesquisa|busca cientifica|buscar evidencia|procure na literatura)/.test(n)) {
                await this.researchOnDemand(input);
                return;
            }

            if (this.isReferenceQuestion(n)) {
                this.answerReferenceQuestion(input);
                return;
            }

            const physicalAnswer = this.queryPatientState(input);
            if (physicalAnswer) {
                this.context.time += 1;
                this.log("PACIENTE", physicalAnswer);
                this.renderState();
                return;
            }

            const exam = this.matchInvestigation(input);
            if (exam) {
                this.revealInvestigation(exam);
                return;
            }

            if (/^(diagnostico|minha hipotese|suspeito|penso em)/.test(n)) {
                this.log("SISTEMA", "Hipótese registrada. Continue a investigação ou conduza o manejo conforme o estado clínico.");
                this.context.phase = "diagnosis";
                return;
            }

            this.log("SISTEMA", "Não encontrei uma ação clínica específica para essa frase. Tente perguntar sobre história, exame físico ou solicitar um exame disponível.");
        }

        queryPatientState(input) {
            const n = normalize(input);
            const h = this.currentCase.history || {};
            const pe = this.currentCase.physical_exam || {};

            if (/idade|quantos anos/.test(n)) return `Tenho ${this.currentCase.patient?.age ?? "idade não informada"} anos.`;
            if (/sexo|homem|mulher/.test(n)) return `Sou ${this.sexLabel(this.currentCase.patient?.sex).toLowerCase()}.`;

            if (/exame fisico|exame clinico|ao exame/.test(n)) return this.formatExam(pe);

            const termMap = [
                ["ictericia|icterico|icterica", "icterícia"],
                ["palidez|palido|palida", "palidez"],
                ["sangramento|sangra|sangue", "sangramento"],
                ["pica", "pica"],
                ["glossite", "glossite"],
                ["queilite", "queilite angular"],
                ["edema|inchaco|inchada|inchado", "edema"],
                ["dor", "dor"]
            ];

            for (const [pattern, label] of termMap) {
                if (new RegExp(pattern).test(n)) {
                    const found = this.findClinicalTerm(label, h, pe);
                    if (found != null) return found ? `Sim. Há ${label} no caso.` : `Não. Não há ${label} registrado no caso.`;
                }
            }

            if (/historia|historico|antecedente|comorbidade|hda/.test(n)) return this.formatHistory(h);
            if (/sintoma|sente|sentindo|queixa/.test(n)) return `A queixa inicial é: ${this.currentCase.presentation?.chief_complaint || "não informada"}.`;

            return null;
        }

        findClinicalTerm(label, history, physical) {
            const target = normalize(label);
            const text = normalize(JSON.stringify({ history, physical }));
            if (text.includes(target)) return true;
            const negatives = ["sem " + target, "nega " + target, "nao apresenta " + target];
            if (negatives.some(item => text.includes(item))) return false;
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

        matchInvestigation(input) {
            const n = normalize(input);
            const inv = this.currentCase.investigations || {};
            if (/hemograma|cbc/.test(n) && inv.initial) return { id: "initial_cbc", name: "Hemograma", result: inv.initial };

            const list = flatten(inv.available || []);
            for (const item of list) {
                const name = normalize(item?.exam || item?.name || item);
                if (name && n.includes(name)) return { id: item.exam || item.id || name, name: item.exam || item.name || name, result: item };
            }
            return null;
        }

        revealInvestigation(exam) {
            this.context.time += 5;
            this.context.revealed.add(exam.id);
            this.log("INVESTIGAÇÃO", `${exam.name} solicitado.`);
            this.log("RESULTADO", this.formatInvestigationResult(exam));
            this.renderState();
        }

        formatInvestigationResult(exam) {
            if (exam.id === "initial_cbc" && exam.result) {
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
                return Object.entries(exam.result).map(([key, value]) => `${labels[key] || key}: ${value}`).join(" | ");
            }
            if (exam.result?.expected_result) return `${exam.result.expected_result}${exam.result.interpretation ? ` — ${exam.result.interpretation}` : ""}`;
            return "Resultado disponível conforme o caso clínico.";
        }

        isReferenceQuestion(n) { return /valor de referencia|valores de referencia|normal|faixa de referencia/.test(n); }

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
                const researcher = new global.CaseResearchEngine({ config: this.researchRules });
                this.research = await researcher.research({
                    concept: this.currentCase.hidden?.diagnosis,
                    primary_concept: this.currentCase.hidden?.diagnosis,
                    anchors: [reason]
                });
                const count = this.research?.evidence?.length || 0;
                this.log("PESQUISA", count ? `${count} registros de evidência retornados.` : "Nenhuma evidência retornada.");
            } finally {
                this.pendingResearch = false;
            }
        }

        showHint() {
            this.log("DICA", "Comece pela história e pelo exame físico antes de avançar para exames complementares.");
        }

        renderState(age, sex) {
            if (!this.elements.stateList) return;
            const c = this.currentCase;
            const revealed = [...this.context.revealed];
            this.elements.stateList.innerHTML = [
                `<li>Paciente: ${escapeHTML(sex || (c?.patient?.sex || "--"))}, ${escapeHTML(age || (c?.patient?.age ? c.patient.age + " anos" : "--"))}</li>`,
                `<li>Estabilidade: ${escapeHTML(c?.initial_state?.stability || "--")}</li>`,
                `<li>Tempo clínico: ${this.context.time} min</li>`,
                `<li>Exames revelados: ${revealed.length}</li>`,
                `<li>Diagnóstico estabelecido: ${this.context.phase === "diagnosis" ? "sim" : "não"}</li>`
            ].join("");
        }

        render() { this.renderState(); }

        clearLog() { if (this.elements.log) this.elements.log.innerHTML = ""; }

        log(type, message) {
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
    global.addEventListener("DOMContentLoaded", () => {
        global.idmtEngine.boot().catch(error => {
            console.error("Diagnosis boot failure:", error);
            global.idmtEngine.log("ERRO", "Não foi possível inicializar o caso clínico.");
        });
    });
})(window);
