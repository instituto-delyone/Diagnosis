"use strict";

/**
 * ============================================================
 * DIAGNOSIS — CLINICAL KNOWLEDGE RESOLVER
 * ============================================================
 *
 * Resolve conhecimento clínico auxiliar para a camada de
 * interação. Não gera pacientes e não decide diagnósticos.
 *
 * Fluxo:
 *   linguagem clínica
 *        ↓
 *   ClinicalKnowledgeResolver
 *        ↓
 *   interaction corpus
 *        ↓
 *   trechos/entradas relevantes
 *
 * O resolver é deliberadamente determinístico e simples:
 * - carrega corpora JSON de interação;
 * - indexa títulos, IDs, aliases e termos;
 * - recupera seções por entidade/tópico;
 * - preserva o texto-fonte sem reescrevê-lo.
 *
 * Ele não substitui UMLS, ClinicalInterlocutor ou Knowledge Base
 * de simulação. É uma ponte entre linguagem e conhecimento.
 */

(function (global) {
    class ClinicalKnowledgeResolver {
        constructor(options = {}) {
            this.basePath = options.basePath || "knowledge_base/interaction";
            this.sources = [];
            this.entries = [];
            this.index = new Map();
            this.loaded = false;
        }

        normalize(value) {
            return String(value || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        }

        tokenize(value) {
            return this.normalize(value)
                .split(" ")
                .filter(token => token.length >= 3);
        }

        addToIndex(term, entry) {
            const normalized = this.normalize(term);
            if (!normalized) return;
            if (!this.index.has(normalized)) this.index.set(normalized, new Set());
            this.index.get(normalized).add(entry.id);
        }

        indexEntry(entry) {
            const fields = [
                entry.id,
                entry.title,
                entry.name,
                entry.topic,
                entry.section,
                entry.chapter,
                ...(Array.isArray(entry.aliases) ? entry.aliases : []),
                ...(Array.isArray(entry.terms) ? entry.terms : [])
            ];

            fields.filter(Boolean).forEach(value => this.addToIndex(value, entry));
            fields.filter(Boolean).forEach(value => {
                this.tokenize(value).forEach(token => this.addToIndex(token, entry));
            });
        }

        flattenCorpus(corpus, sourcePath) {
            const output = [];
            const visit = (value, context = {}) => {
                if (Array.isArray(value)) {
                    value.forEach(item => visit(item, context));
                    return;
                }

                if (!value || typeof value !== "object") return;

                const text = value.source_text || value.text || value.content || value.body;
                const hasClinicalIdentity = value.id || value.title || value.name || value.topic || value.section;

                if (text && hasClinicalIdentity) {
                    const entry = {
                        ...value,
                        id: String(value.id || `${sourcePath}:${output.length}`),
                        source: sourcePath,
                        chapter: value.chapter || context.chapter || null
                    };
                    output.push(entry);
                }

                const nextContext = {
                    chapter: value.chapter || context.chapter || null
                };

                Object.entries(value).forEach(([key, child]) => {
                    if (["source_text", "text", "content", "body"].includes(key)) return;
                    visit(child, nextContext);
                });
            };

            visit(corpus);
            return output;
        }

        async loadSource(path) {
            const response = await fetch(path, { cache: "no-store" });
            if (!response.ok) throw new Error(`Falha ao carregar corpus clínico: HTTP ${response.status}`);
            const corpus = await response.json();
            const entries = this.flattenCorpus(corpus, path);
            this.sources.push({ path, corpus, entries });
            entries.forEach(entry => {
                this.entries.push(entry);
                this.indexEntry(entry);
            });
            return entries.length;
        }

        async load(paths = []) {
            const sourcePaths = paths.length
                ? paths
                : [`${this.basePath}/cardiologia/cardiologia_tratado_interaction_v1.json`];

            for (const path of sourcePaths) {
                await this.loadSource(path);
            }

            this.loaded = true;
            return this.summary();
        }

        scoreEntry(entry, query) {
            const normalizedQuery = this.normalize(query);
            const queryTokens = this.tokenize(query);
            const haystack = this.normalize([
                entry.id,
                entry.title,
                entry.name,
                entry.topic,
                entry.section,
                entry.chapter,
                ...(Array.isArray(entry.aliases) ? entry.aliases : []),
                ...(Array.isArray(entry.terms) ? entry.terms : [])
            ].filter(Boolean).join(" "));

            let score = 0;
            if (haystack.includes(normalizedQuery)) score += 10;
            queryTokens.forEach(token => {
                if (haystack.includes(token)) score += 2;
            });
            return score;
        }

        resolve(query, options = {}) {
            const limit = Number(options.limit || 5);
            const normalizedQuery = this.normalize(query);
            if (!normalizedQuery) return [];

            const candidateIds = new Set();
            this.index.forEach((ids, term) => {
                if (term.includes(normalizedQuery) || normalizedQuery.includes(term)) {
                    ids.forEach(id => candidateIds.add(id));
                }
            });

            const candidates = this.entries
                .filter(entry => candidateIds.has(entry.id))
                .map(entry => ({ entry, score: this.scoreEntry(entry, query) }))
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)
                .map(item => ({
                    ...item.entry,
                    relevance: item.score
                }));

            return candidates;
        }

        search(query, options = {}) {
            return this.resolve(query, options);
        }

        findById(id) {
            const normalizedId = this.normalize(id);
            return this.entries.find(entry => this.normalize(entry.id) === normalizedId) || null;
        }

        getText(entry) {
            if (!entry) return null;
            return entry.source_text || entry.text || entry.content || entry.body || null;
        }

        summary() {
            return {
                loaded: this.loaded,
                sources: this.sources.length,
                entries: this.entries.length,
                index_terms: this.index.size
            };
        }
    }

    global.ClinicalKnowledgeResolver = ClinicalKnowledgeResolver;
})(typeof window !== "undefined" ? window : globalThis);
