"use strict";

/* Diagnosis Engine: conversational phases plus academic PubMed summaries. */
(function () {
    const FILES = {
        vermelha: ["knowledge_base/cirurgia_4.json", "knowledge_base/hipertensao_arterial.json", "cardiologia.json", "knowledge_base/neurologia.json", "knowledge_base/reumatologia.json", "knowledge_base/endocrinologia.json"],
        clinica: ["knowledge_base/cirurgia_4.json", "knowledge_base/hipertensao_arterial.json", "cardiologia.json", "knowledge_base/neurologia.json", "knowledge_base/reumatologia.json", "knowledge_base/endocrinologia.json"]
    };
    const PHASES = ["investigation", "diagnosis", "treatment", "completed"];
    const norm = v => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[!?.,;:()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
    const list = v => (Array.isArray(v) ? v.flat(Infinity) : v == null ? [] : [v]);
    const unique = v => [...new Set(list(v).map(norm).filter(Boolean))];
    const esc = v => String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    const copy = v => { try { return structuredClone(v); } catch (_) { try { return JSON.parse(JSON.stringify(v)); } catch (_) { return v; } } };

    class DiagnosisEngine {
        constructor() {
            const params = new URLSearchParams(location.search);
            this.room = params.get("sala") === "vermelha" ? "vermelha" : "clinica";
            this.sources = []; this.index = 0; this.currentCase = null; this.research = null;
            this.evaluation = { score: 0, mistakes: 0, hints: 0 };
            this.conversationContext = this.newContext();
            this.patient = { stability: 100, elapsedMinutes: 0, status: "active" };
            this.elements = {};
        }

        newContext() { return { phase: "investigation", history: [], lastIntent: null, answered: { investigation: false, diagnosis: false, treatment: false } }; }

        async boot() {
            this.bindUI(); this.setText("roomLabel", this.room === "vermelha" ? "Sala Vermelha" : "Sala Clínica"); this.setText("roomLabelMeta", this.room === "vermelha" ? "Sala Vermelha" : "Sala Clínica"); this.createResearchPanel();
            await this.loadKnowledge(); this.startNewCase();
        }

        bindUI() {
            this.elements = { input: document.getElementById("actionInput"), send: document.getElementById("sendBtn"), hint: document.getElementById("hintBtn"), science: document.getElementById("scienceBtn"), next: document.getElementById("nextBtn"), log: document.getElementById("clinicalLog") };
            this.elements.send?.addEventListener("click", () => this.submitInput());
            this.elements.input?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); this.submitInput(); } });
            this.elements.hint?.addEventListener("click", () => this.requestHint());
            this.elements.science?.addEventListener("click", () => this.showAcademicAnswers());
            this.elements.next?.addEventListener("click", () => this.startNewCase());
        }

        createResearchPanel() {
            if (document.getElementById("academicResearchPanel")) return;
            const panel = document.createElement("section"); panel.id = "academicResearchPanel"; panel.className = "panel"; panel.style.marginTop = "14px";
            panel.innerHTML = `<div class="panel-header"><div><div class="panel-title">Respostas acadêmicas</div><div class="panel-subtitle">Resumo educacional baseado em artigos do PubMed</div></div></div><div id="academicResearchContent" style="padding:16px;line-height:1.6;color:var(--muted)"><p>Clique em “Base científica” para pesquisar o caso atual.</p></div>`;
            document.querySelector("main")?.insertAdjacentElement("afterend", panel);
        }

        async loadKnowledge() {
            for (const file of FILES[this.room] || FILES.clinica) { try { const r = await fetch(file, { cache: "no-store" }); if (r.ok) this.sources.push({ file, data: await r.json() }); } catch (e) { console.warn("Knowledge load failed", file, e); } }
        }

        startNewCase() {
            this.conversationContext = this.newContext(); this.patient = { stability: 100, elapsedMinutes: 0, status: "active" }; this.evaluation = { score: 0, mistakes: 0, hints: 0 }; this.research = null; this.clearLog(); this.setResearch("<p>Clique em “Base científica” para pesquisar o caso atual.</p>");
            if (this.sources.length) { const source = this.sources[this.index++ % this.sources.length]; this.currentCase = this.normalizeCase(source.data, source.file); } else this.currentCase = this.fallbackCase();
            this.log("NOVO CASO", "Caso clínico iniciado. Comece pela investigação."); this.renderAll();
        }

        normalizeCase(raw, sourceFile) {
            let s = copy(raw); if (Array.isArray(s)) s = s[0] || {}; if (s.cases?.length) s = s.cases[0];
            const inv = s.fase_1_investigacao || s.phase_1_investigation || s.investigation || {}, dia = s.fase_2_diagnostico || s.phase_2_diagnosis || s.diagnosis || {}, tx = s.fase_3_conduta || s.phase_3_treatment || s.treatment || {}, final = s.discussao_clinica_final || s.final_discussion || {};
            const p = s.presentation || s.apresentacao || {}; const complaint = p.chief_complaint || p.queixa_principal || s.vinheta_admissao || s.admission_vignette || p.narrative || s.description || "Paciente em avaliação clínica.";
            const expected = { investigation: unique([inv.gabarito_esperado, inv.expected_answers, s.expected_investigation, s.investigations]), diagnosis: unique([dia.gabarito_esperado, dia.expected_answers, s.expected_diagnosis, s.nome_doenca, s.disease_name, s.hidden_state?.diagnosis]), treatment: unique([tx.gabarito_esperado, tx.expected_answers, s.expected_treatment, s.treatment_name, s.hidden_state?.treatment]) };
            expected.investigation.push(...this.aliases(expected.investigation, "investigation")); expected.diagnosis.push(...this.aliases(expected.diagnosis, "diagnosis")); expected.treatment.push(...this.aliases(expected.treatment, "treatment"));
            return { id: s.id || s.id_doenca || `case_${Date.now()}`, title: s.nome_doenca || s.disease_name || s.title || "Caso clínico", specialty: s.especialidade || s.specialty || "Clínica médica", difficulty: s.dificuldade || s.difficulty || "Não informada", complaint: typeof complaint === "string" ? complaint : JSON.stringify(complaint), expected, feedback: { investigation: inv.achado_sucesso || "Investigação adequada.", diagnosis: dia.achado_sucesso || "Diagnóstico correto.", treatment: tx.feedback_sucesso || "Conduta adequada.", final: final.takeaway_message || "Caso resolvido. Revise a fisiopatologia e a conduta." }, sourceFile };
        }

        aliases(items, phase) {
            const r = []; for (const x of items) { const v = norm(x);
                if (phase === "investigation" && /(eco|pocus|ultrassom)/.test(v)) r.push("ecocardiograma", "echocardiogram", "pocus", "cardiac ultrasound");
                if (phase === "investigation" && /(eletro|ecg)/.test(v)) r.push("ecg", "eletrocardiograma", "electrocardiogram");
                if (phase === "diagnosis" && /(tamponamento|cardiac tamponade)/.test(v)) r.push("tamponamento", "tamponamento cardiaco", "cardiac tamponade", "triade de beck", "beck triad");
                if (phase === "treatment" && /pericardio/.test(v)) r.push("pericardiocentese", "pericardial drainage", "pericardial decompression");
            } return r;
        }

        fallbackCase() { return { id: "fallback_tamponade", title: "Tamponamento Cardíaco", specialty: "Cardiologia / Trauma", difficulty: "Avançada", complaint: "Homem de 40 anos com ferimento por arma branca no tórax apresenta dispneia, turgência jugular, bulhas abafadas e hipotensão.", expected: { investigation: ["pocus", "ecocardiograma", "echocardiogram", "ecg"], diagnosis: ["tamponamento", "tamponamento cardiaco", "cardiac tamponade", "triade de beck"], treatment: ["pericardiocentese", "pericardial drainage", "janela pericardica"] }, feedback: { investigation: "O ultrassom revela derrame pericárdico com colapso diastólico.", diagnosis: "Correto: o quadro é tamponamento cardíaco.", treatment: "A descompressão mecânica imediata é salvadora.", final: "O tamponamento causa choque obstrutivo ao impedir o enchimento diastólico." } }; }

        submitInput() { const input = this.elements.input, value = input?.value.trim(); if (!value) return; input.value = ""; this.log("VOCÊ", value); this.processMessage(value); }
        processMessage(input) {
            const value = norm(input), intent = /pontuacao|pontuação|score|nota/.test(value) ? "score" : /dica|hint|ajuda|help/.test(value) ? "help" : /novo caso|proximo caso|próximo caso|new case/.test(value) ? "new" : /ecg|eletro|ecocardi|pocus|ultrassom|echocardi|investig|exame|tomografia|hemograma|gasometria|raio x|radiografia/.test(value) ? "investigation" : /diagnostico|diagnóstico|diagnosis|the diagnosis/.test(value) ? "diagnosis" : /tratamento|tratar|conduta|manejo|treatment|manage|pericardiocentese|intub/.test(value) ? "treatment" : "answer";
            this.conversationContext.history.push({ input, intent, phase: this.conversationContext.phase, timestamp: Date.now() }); this.conversationContext.lastIntent = intent;
            if (intent === "score") return this.showScore(); if (intent === "help") return this.requestHint(); if (intent === "new") return this.startNewCase();
            this.evaluate(input, intent === "investigation" || intent === "diagnosis" || intent === "treatment" ? intent : this.conversationContext.phase);
        }

        evaluate(input, phase) {
            if (phase === "completed") return this.log("CASO", "Caso finalizado. Clique em “Próximo caso” para continuar.");
            const answer = list(this.currentCase.expected[phase]).find(a => { const u = norm(input), v = norm(a); return v && (u.includes(v) || v.includes(u)); });
            this.patient.elapsedMinutes += phase === "investigation" ? 5 : phase === "treatment" ? 2 : 1;
            if (!answer) { this.evaluation.score--; this.evaluation.mistakes++; return this.log("FEEDBACK", `“${input}” foi registrado, mas ainda não corresponde à fase de ${phase}.`); }
            this.evaluation.score += phase === "investigation" ? 2 : 5; this.conversationContext.answered[phase] = true; this.log("CORRETO", `${this.currentCase.feedback[phase]} Resposta reconhecida: ${answer}.`);
            if (phase === "investigation") this.advance("diagnosis"); else if (phase === "diagnosis") this.advance("treatment"); else this.finish();
        }
        advance(phase) { this.conversationContext.phase = phase; this.log("PRÓXIMA ETAPA", phase === "diagnosis" ? "Agora informe o diagnóstico mais provável." : "Agora informe a conduta terapêutica."); this.renderAll(); }
        finish() { this.conversationContext.phase = "completed"; this.patient.status = "completed"; this.log("CASO FINALIZADO", `${this.currentCase.feedback.final} Pontuação final: ${this.evaluation.score}.`); this.renderAll(); }
        requestHint() { this.evaluation.score -= 3; this.evaluation.hints++; const p = this.conversationContext.phase; this.log("DICA", ({ investigation: "Escolha o exame que mais reduza a incerteza.", diagnosis: "Relacione os achados ao resultado da investigação.", treatment: "Escolha a intervenção definitiva.", completed: "O caso já foi finalizado." })[p]); this.renderAll(); }
        showScore() { this.log("PONTUAÇÃO", `Pontuação: ${this.evaluation.score}. Erros: ${this.evaluation.mistakes}. Dicas: ${this.evaluation.hints}.`); }

        /* Clicking the existing Base científica button produces the requested summary. */
        async showAcademicAnswers() {
            const title = this.currentCase?.title || "clinical disease"; this.setResearch(`<p>Pesquisando PubMed para <strong>${esc(title)}</strong>...</p>`); this.log("PESQUISA ACADÊMICA", "Consultando artigos do PubMed. A pesquisa não altera a avaliação do caso.");
            try { const ids = await this.pubmedSearch(`${title} pathophysiology etiology diagnosis treatment`), articles = await this.pubmedFetch(ids); this.research = { articles, retrievedAt: new Date().toISOString() }; this.renderAcademicSummary(title, articles); } catch (e) { console.error(e); this.setResearch("<p>Não foi possível acessar o PubMed agora. Tente novamente mais tarde.</p>"); }
        }
        async pubmedSearch(query) { const u = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"); u.searchParams.set("db", "pubmed"); u.searchParams.set("term", query); u.searchParams.set("retmode", "json"); u.searchParams.set("retmax", "6"); const r = await fetch(u); if (!r.ok) throw Error(r.status); return (await r.json())?.esearchresult?.idlist || []; }
        async pubmedFetch(ids) { if (!ids.length) return []; const u = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"); u.searchParams.set("db", "pubmed"); u.searchParams.set("id", ids.join(",")); u.searchParams.set("retmode", "xml"); const r = await fetch(u); if (!r.ok) throw Error(r.status); const xml = new DOMParser().parseFromString(await r.text(), "text/xml"); return [...xml.querySelectorAll("PubmedArticle")].map(a => ({ pmid: a.querySelector("PMID")?.textContent || "", title: a.querySelector("ArticleTitle")?.textContent || "Artigo sem título", abstract: [...a.querySelectorAll("AbstractText")].map(x => x.textContent).join(" "), journal: a.querySelector("Journal Title")?.textContent || "PubMed", year: a.querySelector("PubDate Year")?.textContent || "", url: `https://pubmed.ncbi.nlm.nih.gov/${a.querySelector("PMID")?.textContent || ""}/` })); }

        renderAcademicSummary(title, articles) {
            if (!articles.length) return this.setResearch(`<p>Nenhum artigo encontrado para <strong>${esc(title)}</strong>.</p>`);
            const all = articles.map(a => a.abstract).join(" "), pick = terms => all.split(/(?<=[.!?])\s+/).filter(s => terms.some(t => norm(s).includes(t))).slice(0, 3).join(" ");
            const section = (terms, fallback) => pick(terms) || fallback;
            const sources = articles.map(a => `<li><a href="${this.safeURL(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a> — ${esc(a.journal)} (${esc(a.year)})</li>`).join("");
            this.setResearch(`<h3>${esc(title)}</h3><p><small>Resumo educacional obtido do PubMed em ${new Date().toLocaleString()}.</small></p><h4>Fisiopatologia</h4><p>${esc(section(["pathophysiology", "mechanism", "fisiopatologia", "hemodynamic"], "Não foi possível extrair uma descrição suficiente do resumo."))}</p><h4>Etiologia</h4><p>${esc(section(["etiology", "etiologic", "cause", "caused", "etiologia"], "Consulte as fontes para as causas descritas."))}</p><h4>Diagnóstico</h4><p>${esc(section(["diagnos", "imaging", "laboratory", "ultrasound", "echocardiography"], "Combine história, exame físico e exames complementares."))}</p><h4>Tratamento</h4><p>${esc(section(["treatment", "management", "therapy", "treated", "manejo"], "A conduta depende da gravidade e das recomendações atualizadas."))}</p><h4>Fontes</h4><ol>${sources}</ol>`); }
        setResearch(html) { const e = document.getElementById("academicResearchContent"); if (e) e.innerHTML = html; }
        safeURL(value) { try { const u = new URL(value); return u.protocol === "https:" ? esc(u.href) : "#"; } catch (_) { return "#"; } }

        renderAll() { if (!this.currentCase) return; this.setText("caseTitle", this.currentCase.title); this.setText("caseIntro", this.currentCase.complaint); this.setText("difficultyLabel", this.currentCase.difficulty); this.setText("difficultyLabelMeta", this.currentCase.difficulty); this.setText("score", this.evaluation.score); const labels = { investigation: "INVESTIGAÇÃO", diagnosis: "DIAGNÓSTICO", treatment: "CONDUTA", completed: "FINALIZADO" }; this.setText("stateStatus", labels[this.conversationContext.phase]); this.setText("stabilityText", `${this.patient.stability}%`); const bar = document.getElementById("stabilityBar"); if (bar) bar.style.width = `${this.patient.stability}%`; const state = document.getElementById("stateList"); if (state) state.innerHTML = `<li><span class="state-key">Fase atual</span><span class="state-value">${labels[this.conversationContext.phase]}</span></li><li><span class="state-key">Tempo</span><span class="state-value">${this.patient.elapsedMinutes} min</span></li><li><span class="state-key">Diagnóstico</span><span class="state-value">${this.conversationContext.answered.diagnosis ? "Estabelecido" : "Não estabelecido"}</span></li>`; }
        setText(id, value) { const e = document.getElementById(id); if (e) e.textContent = String(value ?? ""); }
        clearLog() { if (this.elements.log) this.elements.log.innerHTML = ""; }
        log(type, message) { const log = this.elements.log || document.getElementById("clinicalLog"); if (!log) return; const e = document.createElement("div"); e.className = "log-entry system"; e.innerHTML = `<strong>${esc(type)}</strong><div>${esc(message)}</div>`; log.appendChild(e); log.scrollTop = log.scrollHeight; }
    }
    window.DiagnosisEngine = DiagnosisEngine; window.idmtEngine = new DiagnosisEngine(); document.addEventListener("DOMContentLoaded", () => window.idmtEngine.boot().catch(console.error));
})();
