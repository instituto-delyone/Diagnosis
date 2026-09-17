"use strict";

/*
 * Medical Library runtime.
 *
 * Reads the knowledge files stored in docs/medical_library, extracts text,
 * builds a lightweight in-memory lexical index and exposes contextual search
 * to the Diagnosis Engine. It never treats library text as patient state.
 */
(function () {
    const CONFIG = {
        rulesUrl: "AI/MEDICAL_LIBRARY_RULES.json",
        githubApiUrl: "https://api.github.com/repos/instituto-delyone/Diagnosis/contents/docs/medical_library?ref=main",
        pdfJsUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
        pdfWorkerUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
        mammothUrl: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js"
    };

    const normalize = value => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const escapeHTML = value => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-medical-library-src="${src}"]`);
            if (existing) {
                if (existing.dataset.loaded === "true") return resolve();
                existing.addEventListener("load", resolve, { once: true });
                existing.addEventListener("error", reject, { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.dataset.medicalLibrarySrc = src;
            script.onload = () => {
                script.dataset.loaded = "true";
                resolve();
            };
            script.onerror = () => reject(new Error(`Não foi possível carregar ${src}`));
            document.head.appendChild(script);
        });
    }

    class MedicalLibrary {
        constructor(options = {}) {
            this.config = { ...CONFIG, ...options };
            this.rules = null;
            this.sources = [];
            this.states = new Map();
            this.chunks = [];
            this.loaded = false;
            this.panel = null;
        }

        async init() {
            await this.loadRules();
            this.createStatusPanel();
            return this;
        }

        async loadRules() {
            const response = await fetch(this.config.rulesUrl, { cache: "no-store" });
            if (!response.ok) throw new Error(`Regras da Medical Library indisponíveis (${response.status}).`);
            this.rules = await response.json();
        }

        async discoverSources() {
            const response = await fetch(this.config.githubApiUrl, {
                headers: { Accept: "application/vnd.github+json" },
                cache: "no-store"
            });
            if (!response.ok) throw new Error(`Não foi possível descobrir a Medical Library (${response.status}).`);

            const entries = await response.json();
            this.sources = entries.filter(entry => {
                if (entry.type !== "file") return false;
                const lower = entry.name.toLowerCase();
                return lower.endsWith(".pdf") || lower.endsWith(".docx");
            });

            this.sources.forEach(source => {
                this.states.set(source.path, {
                    path: source.path,
                    name: source.name,
                    status: "loading",
                    chunks: 0,
                    characters: 0,
                    error: null
                });
            });
            this.renderStatus();
            return this.sources;
        }

        async loadAll() {
            if (!this.rules) await this.init();
            await this.discoverSources();

            for (const source of this.sources) {
                await this.loadSource(source);
            }

            this.loaded = true;
            this.renderStatus();
            return this.summary();
        }

        async loadSource(source) {
            const state = this.states.get(source.path);
            if (!state) return;

            state.status = "loading";
            state.error = null;
            this.renderStatus();

            try {
                const lower = source.name.toLowerCase();
                const text = lower.endsWith(".pdf")
                    ? await this.extractPDF(source.download_url || source.html_url)
                    : await this.extractDOCX(source.download_url || source.html_url);

                const chunks = this.chunkText(text);
                chunks.forEach((chunk, index) => {
                    this.chunks.push({
                        id: `${source.path}#${index + 1}`,
                        source: source.name,
                        path: source.path,
                        index,
                        text: chunk,
                        normalized: normalize(chunk)
                    });
                });

                state.status = "loaded";
                state.chunks = chunks.length;
                state.characters = text.length;
            } catch (error) {
                console.warn("Medical Library source failed:", source.name, error);
                state.status = "error";
                state.error = error.message || String(error);
            }

            this.renderStatus();
        }

        async extractPDF(url) {
            await loadScript(this.config.pdfJsUrl);
            if (!window.pdfjsLib) throw new Error("PDF.js não ficou disponível.");
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = this.config.pdfWorkerUrl;

            const response = await fetch(url, { cache: "no-store" });
            if (!response.ok) throw new Error(`Falha ao baixar PDF (${response.status}).`);
            const data = await response.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data }).promise;
            const pages = [];

            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                const page = await pdf.getPage(pageNumber);
                const content = await page.getTextContent();
                const text = content.items.map(item => item.str).join(" ").trim();
                if (text) pages.push(`Página ${pageNumber}: ${text}`);
            }

            return pages.join("\n\n");
        }

        async extractDOCX(url) {
            await loadScript(this.config.mammothUrl);
            if (!window.mammoth) throw new Error("Mammoth não ficou disponível.");

            const response = await fetch(url, { cache: "no-store" });
            if (!response.ok) throw new Error(`Falha ao baixar DOCX (${response.status}).`);
            const arrayBuffer = await response.arrayBuffer();
            const result = await window.mammoth.extractRawText({ arrayBuffer });
            return result.value || "";
        }

        chunkText(text) {
            const target = Number(this.rules?.processing?.chunk_target_characters) || 1800;
            const overlap = Number(this.rules?.processing?.chunk_overlap_characters) || 250;
            const maxChunks = Number(this.rules?.processing?.max_chunks_per_source) || 5000;
            const clean = String(text || "").replace(/\s+/g, " ").trim();
            if (!clean) return [];

            const chunks = [];
            let start = 0;
            while (start < clean.length && chunks.length < maxChunks) {
                let end = Math.min(clean.length, start + target);
                if (end < clean.length) {
                    const boundary = clean.lastIndexOf(" ", end);
                    if (boundary > start + target * 0.65) end = boundary;
                }
                chunks.push(clean.slice(start, end).trim());
                if (end >= clean.length) break;
                start = Math.max(end - overlap, start + 1);
            }
            return chunks.filter(Boolean);
        }

        search(query, context = "", limit) {
            const topK = Number(limit || this.rules?.retrieval?.default_top_k) || 6;
            const q = normalize(`${context} ${query}`);
            const queryWords = [...new Set(q.split(" ").filter(word => word.length >= (this.rules?.processing?.minimum_term_length || 3)))];
            if (!queryWords.length || !this.chunks.length) return [];

            const ranked = this.chunks.map(chunk => {
                let score = 0;
                const exactPhrase = normalize(query);
                if (exactPhrase && chunk.normalized.includes(exactPhrase)) score += 1.0;
                queryWords.forEach(word => {
                    if (chunk.normalized.includes(word)) score += 1 / queryWords.length;
                });
                return { ...chunk, score: Math.min(score, 2) / 2 };
            });

            const minimum = Number(this.rules?.retrieval?.minimum_relevance) || 0.18;
            return ranked
                .filter(item => item.score >= minimum)
                .sort((a, b) => b.score - a.score)
                .slice(0, topK)
                .map(item => ({
                    id: item.id,
                    source: item.source,
                    path: item.path,
                    chunk: item.index + 1,
                    score: Number(item.score.toFixed(3)),
                    text: item.text
                }));
        }

        vocabulary(query = "") {
            const results = this.search(query, "", 12);
            const terms = new Set();
            results.forEach(result => normalize(result.text).split(" ").forEach(word => {
                if (word.length >= 5) terms.add(word);
            }));
            return [...terms];
        }

        summary() {
            const states = [...this.states.values()];
            return {
                sources: states.length,
                loaded: states.filter(state => state.status === "loaded").length,
                errors: states.filter(state => state.status === "error").length,
                chunks: this.chunks.length,
                characters: states.reduce((sum, state) => sum + state.characters, 0)
            };
        }

        createStatusPanel() {
            if (this.panel || !document.body) return;
            this.panel = document.createElement("section");
            this.panel.id = "medicalLibraryStatus";
            this.panel.className = "panel";
            this.panel.style.marginTop = "14px";
            this.panel.innerHTML = `
                <div class="panel-header">
                    <div>
                        <div class="panel-title">📚 Medical Library</div>
                        <div class="panel-subtitle">Conhecimento extra carregado para esta sessão</div>
                    </div>
                    <div id="medicalLibrarySummary" class="panel-subtitle">Preparando...</div>
                </div>
                <div id="medicalLibrarySources" style="padding:14px 16px;display:grid;gap:8px"></div>
            `;

            const academic = document.getElementById("academicResearchPanel");
            if (academic) academic.insertAdjacentElement("beforebegin", this.panel);
            else document.querySelector(".app")?.appendChild(this.panel);
        }

        renderStatus() {
            if (!this.panel) return;
            const summary = this.summary();
            const summaryEl = document.getElementById("medicalLibrarySummary");
            const list = document.getElementById("medicalLibrarySources");
            if (summaryEl) summaryEl.textContent = `${summary.loaded}/${summary.sources} fontes · ${summary.chunks} chunks`;
            if (!list) return;

            list.innerHTML = [...this.states.values()].map(state => {
                const loaded = state.status === "loaded";
                const error = state.status === "error";
                const symbol = loaded ? "●" : error ? "●" : "○";
                const color = loaded ? "var(--success)" : error ? "var(--danger)" : "var(--warning)";
                const detail = loaded
                    ? `${state.chunks} chunks · ${Math.round(state.characters / 1000)}k caracteres`
                    : error
                        ? `Erro: ${escapeHTML(state.error)}`
                        : "lendo e indexando...";
                return `<div style="display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid var(--border);border-radius:9px;background:rgba(255,255,255,.02)">
                    <span style="color:${color};font-size:15px">${symbol}</span>
                    <div style="min-width:0;flex:1"><div style="font-size:13px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(state.name)}</div><div style="font-size:11px;color:var(--muted)">${detail}</div></div>
                </div>`;
            }).join("");
        }
    }

    window.MedicalLibrary = MedicalLibrary;
})();
