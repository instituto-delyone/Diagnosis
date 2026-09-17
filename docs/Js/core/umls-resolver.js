/**
 * ============================================================
 * DIAGNOSYS — UMLS RESOLVER
 * ============================================================
 *
 * Camada de terminologia/normalização semântica.
 *
 * RESPONSABILIDADES:
 *   1. Enviar termos clínicos para o UMLS através de um proxy seguro.
 *   2. Recuperar CUI, nome e metadados conceituais.
 *   3. Recuperar atoms, definições e relações quando solicitado.
 *   4. Produzir uma unidade semântica compatível com o CSI.
 *
 * NÃO:
 *   - diagnostica;
 *   - escolhe hipótese clínica;
 *   - altera PatientState;
 *   - decide conduta;
 *   - pontua o usuário.
 *
 * SEGURANÇA:
 *   A API key do UMLS NÃO deve ficar neste arquivo nem em HTML/JS
 *   público. O navegador conversa com um proxy seguro configurado em
 *   `baseUrl`; o proxy mantém a credencial do UMLS no servidor.
 *
 * FLUXO:
 *
 *   texto clínico
 *        ↓
 *   UMLSResolver
 *        ↓
 *   proxy seguro
 *        ↓
 *   UMLS REST API
 *        ↓
 *   CUI / conceito / semântica
 *        ↓
 *   CSI / Clinical Interlocutor
 *
 * ============================================================
 */
(function (global) {
    "use strict";

    const DEFAULT_PROXY_URL =
        "https://diagnosys-umls-proxy.dr-delyone.workers.dev/api/umls";

    class UMLSResolver {
        constructor(options = {}) {
            const configuredBaseUrl =
                options.baseUrl ||
                global.DIAGNOSYS_CONFIG?.UMLS_API_BASE ||
                DEFAULT_PROXY_URL;

            this.baseUrl = String(configuredBaseUrl).replace(/\/$/, "");
            this.timeoutMs = Number(options.timeoutMs || 10000);
            this.defaultSearchOptions = options.defaultSearchOptions || {};
            this.lastResolution = null;
        }

        buildQuery(params = {}) {
            const query = new URLSearchParams();

            for (const [key, value] of Object.entries(params)) {
                if (value === undefined || value === null || value === "") continue;

                if (Array.isArray(value)) {
                    query.set(key, value.join(","));
                } else {
                    query.set(key, String(value));
                }
            }

            const text = query.toString();
            return text ? `?${text}` : "";
        }

        async request(path, params = {}) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);

            try {
                const url = `${this.baseUrl}/${String(path).replace(/^\//, "")}${this.buildQuery(params)}`;

                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        "Accept": "application/json"
                    },
                    signal: controller.signal
                });

                if (!response.ok) {
                    throw new Error(`UMLS proxy retornou HTTP ${response.status}.`);
                }

                return await response.json();
            } catch (error) {
                if (error?.name === "AbortError") {
                    throw new Error("UMLSResolver: tempo limite excedido ao consultar o serviço.");
                }

                throw error;
            } finally {
                clearTimeout(timer);
            }
        }

        /* ======================================================
           SEARCH
           ====================================================== */
        async search(term, options = {}) {
            const text = String(term || "").trim();

            if (!text) {
                throw new Error("UMLSResolver.search: termo vazio.");
            }

            const params = {
                string: text,
                ...this.defaultSearchOptions,
                ...options
            };

            const data = await this.request("search", params);
            const results = Array.isArray(data?.result?.results)
                ? data.result.results
                : [];

            return {
                query: text,
                count: Number(data?.result?.results?.length || 0),
                pageSize: Number(data?.pageSize || results.length || 0),
                pageNumber: Number(data?.pageNumber || 1),
                results: results.map((item) => ({
                    cui: item?.ui || null,
                    name: item?.name || null,
                    rootSource: item?.rootSource || null,
                    uri: item?.uri || null,
                    source: item?.rootSource || null,
                    raw: item
                })),
                raw: data
            };
        }

        /* ======================================================
           CONCEPT
           ====================================================== */
        async getConcept(cui) {
            const id = String(cui || "").trim();

            if (!id) {
                throw new Error("UMLSResolver.getConcept: CUI vazio.");
            }

            const data = await this.request(`concept/${encodeURIComponent(id)}`);
            const result = data?.result || {};

            return {
                cui: result.ui || id,
                name: result.name || null,
                semanticTypes: Array.isArray(result.semanticTypes)
                    ? result.semanticTypes
                    : [],
                atoms: Number(result.atomCount ?? result.atoms ?? 0) || null,
                raw: data
            };
        }

        /* ======================================================
           ATOMS
           ====================================================== */
        async getAtoms(cui, options = {}) {
            const id = String(cui || "").trim();

            if (!id) {
                throw new Error("UMLSResolver.getAtoms: CUI vazio.");
            }

            const data = await this.request(`concept/${encodeURIComponent(id)}/atoms`, options);
            const atoms = Array.isArray(data?.result) ? data.result : [];

            return {
                cui: id,
                pageSize: Number(data?.pageSize || atoms.length || 0),
                pageNumber: Number(data?.pageNumber || 1),
                pageCount: Number(data?.pageCount || 1),
                atoms: atoms.map((atom) => ({
                    aui: atom?.ui || null,
                    name: atom?.name || null,
                    language: atom?.language || null,
                    rootSource: atom?.rootSource || null,
                    termType: atom?.termType || null,
                    obsolete: atom?.obsolete === "true" || atom?.obsolete === true,
                    suppressible: atom?.suppressible === "true" || atom?.suppressible === true,
                    raw: atom
                })),
                raw: data
            };
        }

        /* ======================================================
           DEFINITIONS
           ====================================================== */
        async getDefinitions(cui, options = {}) {
            const id = String(cui || "").trim();

            if (!id) {
                throw new Error("UMLSResolver.getDefinitions: CUI vazio.");
            }

            const data = await this.request(`concept/${encodeURIComponent(id)}/definitions`, options);
            const definitions = Array.isArray(data?.result) ? data.result : [];

            return {
                cui: id,
                definitions: definitions.map((definition) => ({
                    source: definition?.rootSource || null,
                    value: definition?.value || null,
                    sourceOriginated: definition?.sourceOriginated ?? null,
                    raw: definition
                })),
                raw: data
            };
        }

        /* ======================================================
           RELATIONS
           ====================================================== */
        async getRelations(cui, options = {}) {
            const id = String(cui || "").trim();

            if (!id) {
                throw new Error("UMLSResolver.getRelations: CUI vazio.");
            }

            const data = await this.request(`concept/${encodeURIComponent(id)}/relations`, options);
            const relations = Array.isArray(data?.result) ? data.result : [];

            return {
                cui: id,
                relations,
                raw: data
            };
        }

        /* ======================================================
           NORMALIZAÇÃO CSI
           ====================================================== */
        async normalize(text, options = {}) {
            const rawText = String(text || "").trim();

            if (!rawText) {
                return {
                    raw_text: "",
                    normalized_text: "",
                    language: options.language || "pt-BR",
                    document_anchor: null,
                    semantic_anchor: null,
                    canonical_term: null,
                    match_type: "none",
                    confidence: 0,
                    evidence: [],
                    original_preserved: true,
                    clinical_inference: null,
                    diagnosis: null
                };
            }

            const search = await this.search(rawText, options.search || {});
            const primary = search.results[0] || null;

            const semanticRecord = {
                raw_text: rawText,
                normalized_text: primary?.name || rawText,
                language: options.language || "pt-BR",
                document_anchor: primary?.rootSource || null,
                semantic_anchor: primary?.cui || null,
                canonical_term: primary?.name || null,
                match_type: primary ? "umls" : "none",
                confidence: primary ? 1 : 0,
                evidence: primary
                    ? [{
                        source: "UMLS",
                        cui: primary.cui,
                        rootSource: primary.rootSource,
                        uri: primary.uri
                    }]
                    : [],
                original_preserved: true,
                clinical_inference: null,
                diagnosis: null
            };

            this.lastResolution = semanticRecord;
            return semanticRecord;
        }

        async testConnection() {
            const result = await this.search("dispneia", {
                ...this.defaultSearchOptions
            });

            return {
                ok: true,
                query: result.query,
                results: result.results.slice(0, 5).map((item) => ({
                    cui: item.cui,
                    name: item.name,
                    rootSource: item.rootSource
                }))
            };
        }
    }

    global.UMLSResolver = UMLSResolver;
})(window);
