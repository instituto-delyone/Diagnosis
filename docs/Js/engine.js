"use strict";

/*
 * Diagnosis: knowledge-driven fictional patient simulator.
 *
 * The case generator remains knowledge-driven, but the interaction layer is
 * conversational: natural-language input is interpreted before the case phase
 * is evaluated. No external LLM/API is required for the local conversation.
 */
(function () {
    const KNOWLEDGE_FILES = {
        interaction: "knowledge_base/interaction/cardiologia/cardiologia_tratado_interaction_v1.json",
        structured: [
            "knowledge_base/cirurgia_4.json",
            "knowledge_base/hipertensao_arterial.json",
            "knowledge_base/neurologia.json",
            "knowledge_base/reumatologia.json",
            "knowledge_base/endocrinologia.json"
        ]
    };

    const PHASES = ["investigation", "diagnosis", "treatment", "completed"];
    const normalize = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[!?.,;:()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
    const flatten = value => Array.isArray(value) ? value.flat(Infinity) : value == null ? [] : [value];
    const escapeHTML = value => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

    class KnowledgeDrivenCaseGenerator {
        constructor() { this.corpus = null; this.structured = []; }

        async load() {
            const files = [KNOWLEDGE_FILES.interaction, ...KNOWLEDGE_FILES.structured];
            for (const file of files) {
                try {
                    const response = await fetch(file, { cache: "no-store" });
                    if (!response.ok) continue;
                    const data = await response.json();
                    if (file.includes("interaction")) this.corpus = data;
                    else this.structured.push({ file, data });
                } catch (error) {
                    console.warn("Knowledge source unavailable:", file, error);
                }
            }
        }

        terms(group) {
            return Object.entries(this.corpus?.lexicon?.[group] || {}).map(([id, aliases]) => ({
                id,
                name: aliases?.[0] || id,
                aliases: flatten(aliases)
            }));
        }

        sections(query) {
            const words = normalize(query).split(" ").filter(word => word.length > 2);
            return (this.corpus?.sections || [])
                .map(section => {
                    const searchable = normalize([section.chapter, section.section, section.search_terms, section.source_text].flat().join(" "));
                    const score = words.reduce((total, word) => total + (searchable.includes(word) ? 1 : 0), 0);
                    return { ...section, score };
                })
                .filter(section => section.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 8);
        }

        text(section) { return flatten(section?.source_text).join(" "); }
        random(items) { return items[Math.floor(Math.random() * items.length)]; }

        generate() {
            const diseases = this.terms("conditions");
            const disease = this.random(diseases.length ? diseases : [{ id: "cardiac_condition", name: "condição cardiovascular", aliases: [] }]);
            const symptoms = this.terms("symptoms");
            const selectedSymptoms = symptoms.sort(() => Math.random() - .5).slice(0, Math.min(3, Math.max(1, symptoms.length)));
            const evidence = this.sections(`${disease.name} quadro clínico diagnóstico tratamento`);
            const diagnosisSections = this.sections(`${disease.name} diagnóstico`);
            const treatmentSections = this.sections(`${disease.name} tratamento manejo`);
            const investigations = this.terms("investigations").filter(item => /ecg|eco|radiograf|troponina|cateter|resson|esforco|teste/.test(normalize(item.name))).slice(0, 4);
            const age = 25 + Math.floor(Math.random() * 60);

            return {
                id: `fictional_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                title: disease.name,
                specialty: "Cardiologia",
                difficulty: "Gerado por conhecimento",
                fictional: true,
                source: {
                    corpus: KNOWLEDGE_FILES.interaction,
                    evidenceSections: evidence.map(section => ({ id: section.id, chapter: section.chapter, section: section.section }))
                },
                demographics: { age, sex: Math.random() > .5 ? "female" : "male" },
                presentation: {
                    chief_complaint: {
                        symptoms: selectedSymptoms.map(item => item.id),
                        labels: selectedSymptoms.map(item => item.name),
                        narrative: `Paciente de ${age} anos apresenta ${selectedSymptoms.map(item => item.name).join(", ")}.`
                    }
                },
                expected: {
                    investigation: investigations.flatMap(item => [item.id, item.name, ...item.aliases]),
                    diagnosis: [disease.id, disease.name, ...disease.aliases],
                    treatment: treatmentSections.flatMap(section => [section.section, ...flatten(section.search_terms)]).slice(0, 12)
                },
                educational: {
                    etiology: this.text(this.sections(`${disease.name} etiologia etiopatogenia`)[0]),
                    pathophysiology: this.text(this.sections(`${disease.name} fisiopatologia`)[0]),
                    diagnosis: this.text(diagnosisSections[0]),
                    treatment: this.text(treatmentSections[0]),
                    references: evidence
                }
            };
        }

        validate(caseData) {
            const errors = [];
            if (!caseData.fictional) errors.push("Case is not marked fictional");
            if (!caseData.title) errors.push("Missing condition");
            if (!caseData.presentation?.chief_complaint?.symptoms?.length) errors.push("Missing presentation");
            if (!caseData.expected?.diagnosis?.length) errors.push("Missing diagnosis candidates");
            return { valid: errors.length === 0, errors };
        }
    }

    class DiagnosisEngine {
        constructor() {
            const params = new URLSearchParams(location.search);
            this.room = params.get("sala") === "vermelha" ? "vermelha" : "clinica";
            this.generator = new KnowledgeDrivenCaseGenerator();
            this.currentCase = null;
            this.research = null;
            this.elements = {};
            this.semanticResolver = null;
            this.context = {
                phase: "investigation",
                history: [],
                answered: {},
                pendingAction: null
            };
            this.score = 0;
            this.errors = 0;
            this.hints = 0;
            this.time = 0;
        }

        async loadSemanticRuntime() {
            if (window.ClinicalKnowledgeResolver) {
                this.semanticResolver = new window.ClinicalKnowledgeResolver({ basePath: "knowledge_base/interaction" });
                try {
                    await this.semanticResolver.load([KNOWLEDGE_FILES.interaction]);
                    this.log("SEMÂNTICA", `CSI carregado: ${this.semanticResolver.summary().semantic_concepts} conceitos e ${this.semanticResolver.summary().semantic_intents} intenções.`);
                } catch (error) {
                    console.warn("CSI runtime unavailable:", error);
                }
                return;
            }

            await new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "Js/core/clinical-knowledge-resolver.js";
                script.onload = resolve;
                script.onerror = () => reject(new Error("Não foi possível carregar ClinicalKnowledgeResolver."));
                document.head.appendChild(script);
            });

            this.semanticResolver = new window.ClinicalKnowledgeResolver({ basePath: "knowledge_base/interaction" });
            try {
                await this.semanticResolver.load([KNOWLEDGE_FILES.interaction]);
                const summary = this.semanticResolver.summary();
                this.log("SEMÂNTICA", `CSI carregado: ${summary.semantic_concepts} conceitos e ${summary.semantic_intents} intenções.`);
            } catch (error) {
                console.warn("CSI runtime unavailable:", error);
            }
        }

        async boot() {
            this.bindUI();
            this.setText("roomLabel", this.room === "vermelha" ? "Sala Vermelha" : "Sala Clínica");
            this.setText("roomLabelMeta", this.room === "vermelha" ? "Sala Vermelha" : "Sala Clínica");
            this.createAcademicPanel();
            await this.loadSemanticRuntime();
            await this.generator.load();
            this.startNewCase();
        }

        bindUI() {
            this.elements = {
                input: document.getElementById("actionInput"),
                send: document.getElementById("sendBtn"),
                hint: document.getElementById("hintBtn"),
                science: document.getElementById("scienceBtn"),
                next: document.getElementById("nextBtn"),
                log: document.getElementById("clinicalLog")
            };
            this.elements.send?.addEventListener("click", () => this.submit());
            this.elements.input?.addEventListener("keydown", event => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    this.submit();
                }
            });
            this.elements.hint?.addEventListener("click", () => this.hint());
            this.elements.science?.addEventListener("click", () => this.academicAnswers());
            this.elements.next?.addEventListener("click", () => this.startNewCase());
        }

        createAcademicPanel() {
            if (document.getElementById("academicResearchPanel")) return;
            const panel = document.createElement("section");
            panel.id = "academicResearchPanel";
            panel.className = "panel";
            panel.style.marginTop = "14px";
            panel.innerHTML = `<div class="panel-header"><div><div class="panel-title">Conhecimento acadêmico</div><div class="panel-subtitle">Fontes locais do tratado e literatura atual</div></div></div><div id="academicResearchContent" style="padding:16px;line-height:1.6;color:var(--muted)"><p>O caso é gerado a partir do conhecimento local. Clique em “Base científica” para estudar a doença.</p></div>`;
            document.querySelector("main")?.insertAdjacentElement("afterend", panel);
        }

        startNewCase() {
            this.context = { phase: "investigation", history: [], answered: {}, pendingAction: null };
            this.score = 0;
            this.errors = 0;
            this.hints = 0;
            this.time = 0;
            this.research = null;
            this.clearLog();
            this.setResearch("<p>Novo paciente fictício gerado a partir da base de conhecimento.</p>");

            let generated = this.generator.generate();
            for (let attempt = 0; attempt < 5 && !this.generator.validate(generated).valid; attempt++) generated = this.generator.generate();
            this.currentCase = generated;

            this.log("NOVO CASO", "Paciente fictício gerado por conhecimento clínico. Nenhum caso real foi utilizado.");
            this.log("PACIENTE", "Estou pronto. Você pode perguntar sobre a queixa, história, sintomas ou me dizer o que pretende fazer.");
            this.render();
        }

        submit() {
            const value = this.elements.input?.value.trim();
            if (!value) return;
            this.elements.input.value = "";
            this.log("VOCÊ", value);
            this.process(value);
        }

        semanticInterpret(input) {
            try {
                return this.semanticResolver?.resolveSemantic?.(input) || null;
            } catch (error) {
                console.warn("Semantic interpretation failed:", error);
                return null;
            }
        }

        isQuestion(value) {
            return /^(o que|qual|como|quando|onde|por que|porque|há quanto|quanto tempo|me diga|pode me dizer|refere|refere-se)/.test(value)
                || /\?$/.test(String(value || "").trim());
        }

        detectAction(input, semantic) {
            const value = normalize(input);
            const history = this.context.history;
            const previous = history[history.length - 1];

            const medicationNames = [
                "diazepam", "midazolam", "lorazepam", "haloperidol", "fenitoina", "fenobarbital",
                "levetiracetam", "valproato", "insulina", "adrenalina", "noradrenalina", "morfina", "furosemida"
            ];
            const treatmentVerb = /\b(trato|tratar|inicio|iniciar|administro|administrar|prescrevo|prescrever|dou|dar|manejo|conduta|interven[cç][aã]o|terapia)\b/.test(value);
            const hasMedication = medicationNames.some(name => value.includes(name));
            const investigation = /\b(ecg|eletrocardiograma|eco|ecocardiograma|ultrassom|radiografia|raio x|troponina|cateter|ressonancia|ressonancia magnetica|exame|investigar|investigacao|solicito)\b/.test(value);
            const diagnosis = /\b(diagnostico|diagnosticar|hipotese|hipotese diagnostica|penso em|acredito que|suspeito de)\b/.test(value);

            if (hasMedication && (previous?.action === "treatment" || previous?.intent === "treatment")) {
                return { type: "treatment_detail", concept: input.trim(), semantic };
            }
            if (treatmentVerb || hasMedication || semantic?.intent === "treatment_proposal" || semantic?.action === "record_treatment") {
                return { type: "treatment", concept: input.trim(), semantic };
            }
            if (investigation) return { type: "investigation", concept: input.trim(), semantic };
            if (diagnosis || (this.context.phase === "diagnosis" && !this.isQuestion(value))) return { type: "diagnosis", concept: input.trim(), semantic };
            if (this.isQuestion(value)) return { type: "question", concept: input.trim(), semantic };
            return { type: "statement", concept: input.trim(), semantic };
        }

        answerQuestion(input) {
            const value = normalize(input);
            const p = this.currentCase.presentation?.chief_complaint || {};
            const labels = p.labels || [];

            if (/queixa|motivo|trouxe|veio|consulta/.test(value)) {
                return `Minha queixa principal é ${labels.join(", ") || "o quadro descrito na apresentação"}.`;
            }
            if (/sintoma|sentindo|sente|refer/.test(value)) {
                return `Estou apresentando ${labels.join(", ") || "os sintomas descritos no caso"}.`;
            }
            if (/idade|quantos anos/.test(value)) {
                return `Tenho ${this.currentCase.demographics.age} anos.`;
            }
            if (/quem|sexo|homem|mulher/.test(value)) {
                return `Sexo registrado no caso: ${this.currentCase.demographics.sex === "female" ? "feminino" : "masculino"}.`;
            }
            if (/diagnostico|doenca|doença/.test(value)) {
                return "Ainda não tenho um diagnóstico estabelecido. Você pode continuar a investigação antes de formular sua hipótese.";
            }
            if (/historia|história|hda|antecedente|comorbidade|passado/.test(value)) {
                return "Posso fornecer a história detalhada conforme você investigar. No momento, a apresentação inicial disponível é a queixa e os sintomas descritos acima.";
            }
            if (/medicamento|remedio|remédio|alergia/.test(value)) {
                return "Essa informação ainda não foi definida neste caso gerado. Você pode solicitá-la como parte da investigação da história clínica.";
            }
            return "Entendi sua pergunta. Essa informação ainda não está disponível no estado atual do paciente; você pode especificar o aspecto da história ou do exame que deseja investigar.";
        }

        process(input) {
            const value = normalize(input);
            if (/pontuacao|pontuação|score|nota/.test(value)) return this.log("PONTUAÇÃO", `Pontuação: ${this.score}. Erros: ${this.errors}.`);
            if (/dica|hint|ajuda|help/.test(value)) return this.hint();
            if (/novo caso|proximo caso|próximo caso|new case/.test(value)) return this.startNewCase();

            const semantic = this.semanticInterpret(input);
            const action = this.detectAction(input, semantic);
            this.context.history.push({ input, phase: this.context.phase, ...action, timestamp: Date.now() });

            if (action.type === "question") {
                this.time += 1;
                return this.log("PACIENTE", this.answerQuestion(input));
            }

            if (action.type === "treatment_detail") {
                this.time += 1;
                this.context.pendingAction = { type: "treatment", detail: action.concept, previous: this.context.pendingAction };
                return this.log("PACIENTE", `Entendi. Você está especificando ${action.concept} para a conduta que acabou de propor. Registrei a medicação no contexto da intervenção. Qual é o próximo passo?`);
            }

            if (action.type === "treatment") {
                this.time += 2;
                this.context.phase = "treatment";
                this.context.pendingAction = { type: "treatment", text: action.concept };
                this.context.answered.treatment = true;
                this.score += 1;
                this.log("INTERPRETAÇÃO", `Entendi sua proposta terapêutica: ${action.concept}.`);
                this.log("PACIENTE", "Conduta registrada no caso. Você pode especificar a medicação, fazer outra intervenção ou perguntar como o paciente evoluiu.");
                this.render();
                return;
            }

            if (action.type === "investigation") {
                return this.evaluateInvestigation(input);
            }

            if (action.type === "diagnosis") {
                return this.evaluateDiagnosis(input);
            }

            this.time += 1;
            this.log("PACIENTE", "Entendi a informação. Você pode perguntar sobre o paciente ou indicar a próxima ação clínica.");
            this.render();
        }

        evaluateInvestigation(input) {
            const normalized = normalize(input);
            const candidates = flatten(this.currentCase.expected.investigation).filter(Boolean);
            const answer = candidates.find(item => {
                const a = normalize(item);
                return a && (normalized.includes(a) || a.includes(normalized));
            });

            this.time += 5;
            if (!answer) {
                this.errors++;
                this.score--;
                this.log("INTERPRETAÇÃO", `Entendi que você quer investigar: ${input}. Esse exame não está entre as investigações previstas pelo caso gerado.`);
                this.render();
                return;
            }

            this.context.phase = "diagnosis";
            this.context.answered.investigation = true;
            this.score += 2;
            this.log("INVESTIGAÇÃO", `${answer} solicitada e registrada.`);
            this.log("PACIENTE", "Investigação registrada. Com os dados disponíveis agora, qual é sua hipótese diagnóstica principal?");
            this.render();
        }

        evaluateDiagnosis(input) {
            const normalized = normalize(input);
            const candidates = flatten(this.currentCase.expected.diagnosis).filter(Boolean);
            const answer = candidates.find(item => {
                const a = normalize(item);
                return a && (normalized.includes(a) || a.includes(normalized));
            });

            this.time += 1;
            if (!answer) {
                this.errors++;
                this.score--;
                this.log("FEEDBACK", `Hipótese registrada: ${input}. Ela não corresponde à condição que gerou este caso. Você pode continuar investigando ou reformular a hipótese.`);
                this.render();
                return;
            }

            this.context.phase = "treatment";
            this.context.answered.diagnosis = true;
            this.score += 5;
            this.log("DIAGNÓSTICO", `Hipótese compatível com o caso: ${answer}.`);
            this.log("PRÓXIMA ETAPA", "Agora estabeleça a conduta. Você pode escrever a intervenção em linguagem natural.");
            this.render();
        }

        hint() {
            this.score -= 3;
            this.hints++;
            const messages = {
                investigation: "Pergunte sobre o paciente ou solicite uma investigação compatível com a apresentação.",
                diagnosis: "Compare a apresentação e os dados obtidos com as condições possíveis antes de formular a hipótese.",
                treatment: "Descreva a conduta em linguagem natural; depois você pode especificar a medicação ou intervenção.",
                completed: "O caso já foi concluído."
            };
            this.log("DICA", messages[this.context.phase]);
            this.render();
        }

        academicAnswers() {
            const e = this.currentCase.educational;
            const refs = (e.references || []).map(section => `<li>${escapeHTML(section.chapter || "")}: ${escapeHTML(section.section || "")}</li>`).join("");
            this.setResearch(`<h3>${escapeHTML(this.currentCase.title)}</h3><p><strong>Paciente:</strong> fictício e gerado por restrições da base local.</p><h4>Etiologia</h4><p>${escapeHTML(e.etiology || "Não localizada no corpus.")}</p><h4>Fisiopatologia</h4><p>${escapeHTML(e.pathophysiology || "Não localizada no corpus.")}</p><h4>Diagnóstico</h4><p>${escapeHTML(e.diagnosis || "Não localizada no corpus.")}</p><h4>Tratamento</h4><p>${escapeHTML(e.treatment || "Não localizada no corpus.")}</p><h4>Seções consultadas</h4><ol>${refs}</ol>`);
            this.log("BASE CIENTÍFICA", "Resumo recuperado do tratado local; ele não altera automaticamente o caso.");
        }

        render() {
            if (!this.currentCase) return;
            this.setText("caseTitle", this.currentCase.title);
            this.setText("caseIntro", this.currentCase.presentation.chief_complaint.narrative);
            this.setText("difficultyLabel", this.currentCase.difficulty);
            this.setText("difficultyLabelMeta", this.currentCase.difficulty);
            this.setText("score", this.score);
            const labels = { investigation: "INVESTIGAÇÃO", diagnosis: "DIAGNÓSTICO", treatment: "CONDUTA", completed: "FINALIZADO" };
            this.setText("stateStatus", labels[this.context.phase]);
            this.setText("stabilityText", "100%");
            const list = document.getElementById("stateList");
            if (list) {
                list.innerHTML = `<li><span class="state-key">Fase atual</span><span class="state-value">${labels[this.context.phase]}</span></li><li><span class="state-key">Tempo</span><span class="state-value">${this.time} min</span></li><li><span class="state-key">Diagnóstico</span><span class="state-value">${this.context.answered.diagnosis ? "Estabelecido" : "Não estabelecido"}</span></li><li><span class="state-key">Conversa</span><span class="state-value">${this.context.history.length} interações</span></li>`;
            }
        }

        setText(id, value) {
            const element = document.getElementById(id);
            if (element) element.textContent = String(value ?? "");
        }

        setResearch(html) {
            const element = document.getElementById("academicResearchContent");
            if (element) element.innerHTML = html;
        }

        clearLog() {
            if (this.elements.log) this.elements.log.innerHTML = "";
        }

        log(type, message) {
            const log = this.elements.log || document.getElementById("clinicalLog");
            if (!log) return;
            const entry = document.createElement("div");
            entry.className = "log-entry system";
            entry.innerHTML = `<strong>${escapeHTML(type)}</strong><div>${escapeHTML(message)}</div>`;
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }
    }

    window.KnowledgeDrivenCaseGenerator = KnowledgeDrivenCaseGenerator;
    window.DiagnosisEngine = DiagnosisEngine;
    window.idmtEngine = new DiagnosisEngine();
    document.addEventListener("DOMContentLoaded", () => window.idmtEngine.boot().catch(error => console.error("DIAGNOSIS ENGINE:", error)));
})();
