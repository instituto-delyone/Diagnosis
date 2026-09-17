"use strict";

/*
 * Diagnosis: knowledge-driven fictional patient simulator.
 *
 * Cases are generated from local medical knowledge, never copied from real
 * patients. The local treatise corpus is used for terminology and educational
 * context; it is not treated as a case bank.
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
    const copy = value => { try { return structuredClone(value); } catch (_) { try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; } } };
    const escapeHTML = value => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

    class KnowledgeDrivenCaseGenerator {
        constructor() { this.corpus = null; this.structured = []; }
        async load() {
            const files = [KNOWLEDGE_FILES.interaction, ...KNOWLEDGE_FILES.structured];
            for (const file of files) {
                try { const response = await fetch(file, { cache: "no-store" }); if (!response.ok) continue; const data = await response.json(); if (file.includes("interaction")) this.corpus = data; else this.structured.push({ file, data }); } catch (error) { console.warn("Knowledge source unavailable:", file, error); }
            }
        }
        terms(group) { return Object.entries(this.corpus?.lexicon?.[group] || {}).map(([id, aliases]) => ({ id, name: aliases?.[0] || id, aliases: flatten(aliases) })); }
        sections(query) {
            const words = normalize(query).split(" ").filter(word => word.length > 2);
            return (this.corpus?.sections || []).map(section => { const searchable = normalize([section.chapter, section.section, section.search_terms, section.source_text].flat().join(" ")); const score = words.reduce((total, word) => total + (searchable.includes(word) ? 1 : 0), 0); return { ...section, score }; }).filter(section => section.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
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
                source: { corpus: KNOWLEDGE_FILES.interaction, evidenceSections: evidence.map(section => ({ id: section.id, chapter: section.chapter, section: section.section })) },
                demographics: { age, sex: Math.random() > .5 ? "female" : "male" },
                presentation: { chief_complaint: { symptoms: selectedSymptoms.map(item => item.id), labels: selectedSymptoms.map(item => item.name), narrative: `Paciente de ${age} anos apresenta ${selectedSymptoms.map(item => item.name).join(", ")}.` } },
                expected: { investigation: investigations.flatMap(item => [item.id, item.name, ...item.aliases]), diagnosis: [disease.id, disease.name, ...disease.aliases], treatment: treatmentSections.flatMap(section => [section.section, ...flatten(section.search_terms)]).slice(0, 12) },
                educational: { etiology: this.text(this.sections(`${disease.name} etiologia etiopatogenia`)[0]), pathophysiology: this.text(this.sections(`${disease.name} fisiopatologia`)[0]), diagnosis: this.text(diagnosisSections[0]), treatment: this.text(treatmentSections[0]), references: evidence }
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
            this.generator = new KnowledgeDrivenCaseGenerator(); this.currentCase = null; this.research = null; this.elements = {};
            this.context = { phase: "investigation", history: [], answered: {} }; this.score = 0; this.errors = 0; this.hints = 0; this.time = 0;
        }
        async boot() { this.bindUI(); this.setText("roomLabel", this.room === "vermelha" ? "Sala Vermelha" : "Sala Clínica"); this.setText("roomLabelMeta", this.room === "vermelha" ? "Sala Vermelha" : "Sala Clínica"); this.createAcademicPanel(); await this.generator.load(); this.startNewCase(); }
        bindUI() { this.elements = { input: document.getElementById("actionInput"), send: document.getElementById("sendBtn"), hint: document.getElementById("hintBtn"), science: document.getElementById("scienceBtn"), next: document.getElementById("nextBtn"), log: document.getElementById("clinicalLog") }; this.elements.send?.addEventListener("click", () => this.submit()); this.elements.input?.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); this.submit(); } }); this.elements.hint?.addEventListener("click", () => this.hint()); this.elements.science?.addEventListener("click", () => this.academicAnswers()); this.elements.next?.addEventListener("click", () => this.startNewCase()); }
        createAcademicPanel() { if (document.getElementById("academicResearchPanel")) return; const panel = document.createElement("section"); panel.id = "academicResearchPanel"; panel.className = "panel"; panel.style.marginTop = "14px"; panel.innerHTML = `<div class="panel-header"><div><div class="panel-title">Conhecimento acadêmico</div><div class="panel-subtitle">Fontes locais do tratado e literatura atual</div></div></div><div id="academicResearchContent" style="padding:16px;line-height:1.6;color:var(--muted)"><p>O caso é gerado a partir do conhecimento local. Clique em “Base científica” para estudar a doença.</p></div>`; document.querySelector("main")?.insertAdjacentElement("afterend", panel); }
        startNewCase() { this.context = { phase: "investigation", history: [], answered: {} }; this.score = 0; this.errors = 0; this.hints = 0; this.time = 0; this.research = null; this.clearLog(); this.setResearch("<p>Novo paciente fictício gerado a partir da base de conhecimento.</p>"); let generated = this.generator.generate(); for (let attempt = 0; attempt < 5 && !this.generator.validate(generated).valid; attempt++) generated = this.generator.generate(); this.currentCase = generated; this.log("NOVO CASO", "Paciente fictício gerado por conhecimento clínico. Nenhum caso real foi utilizado."); this.render(); }
        submit() { const value = this.elements.input?.value.trim(); if (!value) return; this.elements.input.value = ""; this.log("VOCÊ", value); this.process(value); }
        process(input) { const value = normalize(input); let phase = this.context.phase; if (/pontuacao|pontuação|score|nota/.test(value)) return this.log("PONTUAÇÃO", `Pontuação: ${this.score}. Erros: ${this.errors}.`); if (/dica|hint|ajuda|help/.test(value)) return this.hint(); if (/novo caso|proximo caso|próximo caso|new case/.test(value)) return this.startNewCase(); if (/ecg|eco|ultrassom|radiograf|troponina|cateter|resson|exame|investig/.test(value)) phase = "investigation"; else if (/diagnostico|diagnóstico|diagnosis/.test(value)) phase = "diagnosis"; else if (/tratamento|tratar|conduta|manejo|treatment|manage/.test(value)) phase = "treatment"; this.context.history.push({ input, phase, timestamp: Date.now() }); this.evaluate(input, phase); }
        evaluate(input, phase) { if (phase === "completed") return this.log("CASO", "Caso concluído. Gere outro caso para continuar."); const answer = flatten(this.currentCase.expected[phase]).find(item => { const a = normalize(item), b = normalize(input); return a && (b.includes(a) || a.includes(b)); }); this.time += phase === "investigation" ? 5 : phase === "treatment" ? 2 : 1; if (!answer) { this.score--; this.errors++; return this.log("FEEDBACK", `Resposta registrada, mas não validada para a fase de ${phase}. Consulte a evidência ou tente outra hipótese.`); } this.score += phase === "investigation" ? 2 : 5; this.context.answered[phase] = true; this.log("CORRETO", `Resposta compatível com o conhecimento gerador: ${answer}.`); if (phase === "investigation") this.advance("diagnosis"); else if (phase === "diagnosis") this.advance("treatment"); else { this.context.phase = "completed"; this.log("CASO FINALIZADO", "Caso fictício resolvido. Revise as fontes acadêmicas para aprofundar o estudo."); } this.render(); }
        advance(phase) { this.context.phase = phase; this.log("PRÓXIMA ETAPA", phase === "diagnosis" ? "Agora estabeleça o diagnóstico." : "Agora escolha a conduta."); this.render(); }
        hint() { this.score -= 3; this.hints++; const messages = { investigation: "Escolha um exame listado como investigação possível para a apresentação.", diagnosis: "Compare a apresentação com a condição que gerou o paciente.", treatment: "Consulte as seções de tratamento da doença.", completed: "O caso já foi concluído." }; this.log("DICA", messages[this.context.phase]); this.render(); }
        academicAnswers() { const e = this.currentCase.educational, refs = (e.references || []).map(section => `<li>${escapeHTML(section.chapter || "")}: ${escapeHTML(section.section || "")} </li>`).join(""); this.setResearch(`<h3>${escapeHTML(this.currentCase.title)}</h3><p><strong>Paciente:</strong> fictício e gerado por restrições da base local.</p><h4>Etiologia</h4><p>${escapeHTML(e.etiology || "Não localizada no corpus.")}</p><h4>Fisiopatologia</h4><p>${escapeHTML(e.pathophysiology || "Não localizada no corpus.")}</p><h4>Diagnóstico</h4><p>${escapeHTML(e.diagnosis || "Não localizada no corpus.")}</p><h4>Tratamento</h4><p>${escapeHTML(e.treatment || "Não localizada no corpus.")}</p><h4>Seções consultadas</h4><ol>${refs}</ol>`); this.log("BASE CIENTÍFICA", "Resumo recuperado do tratado local; ele não altera automaticamente o caso."); }
        render() { this.setText("caseTitle", this.currentCase.title); this.setText("caseIntro", this.currentCase.presentation.chief_complaint.narrative); this.setText("difficultyLabel", this.currentCase.difficulty); this.setText("difficultyLabelMeta", this.currentCase.difficulty); this.setText("score", this.score); const labels = { investigation: "INVESTIGAÇÃO", diagnosis: "DIAGNÓSTICO", treatment: "CONDUTA", completed: "FINALIZADO" }; this.setText("stateStatus", labels[this.context.phase]); this.setText("stabilityText", "100%"); const list = document.getElementById("stateList"); if (list) list.innerHTML = `<li><span class="state-key">Fase atual</span><span class="state-value">${labels[this.context.phase]}</span></li><li><span class="state-key">Tempo</span><span class="state-value">${this.time} min</span></li><li><span class="state-key">Diagnóstico</span><span class="state-value">${this.context.answered.diagnosis ? "Estabelecido" : "Não estabelecido"}</span></li>`; }
        setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = String(value ?? ""); }
        setResearch(html) { const element = document.getElementById("academicResearchContent"); if (element) element.innerHTML = html; }
        clearLog() { if (this.elements.log) this.elements.log.innerHTML = ""; }
        log(type, message) { const log = this.elements.log || document.getElementById("clinicalLog"); if (!log) return; const entry = document.createElement("div"); entry.className = "log-entry system"; entry.innerHTML = `<strong>${escapeHTML(type)}</strong><div>${escapeHTML(message)}</div>`; log.appendChild(entry); log.scrollTop = log.scrollHeight; }
    }
    window.KnowledgeDrivenCaseGenerator = KnowledgeDrivenCaseGenerator; window.DiagnosisEngine = DiagnosisEngine; window.idmtEngine = new DiagnosisEngine(); document.addEventListener("DOMContentLoaded", () => window.idmtEngine.boot().catch(error => console.error("DIAGNOSIS ENGINE:", error)));
})();
