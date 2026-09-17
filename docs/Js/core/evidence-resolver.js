/**
 * ============================================================
 * DIAGNOSYS — EVIDENCE RESOLVER
 * ============================================================
 *
 * Camada de acesso a evidência científica externa.
 *
 * Responsabilidades:
 *   1. Pesquisar artigos no PubMed via NCBI E-utilities.
 *   2. Recuperar registros PubMed por PMID.
 *   3. Recuperar artigos PMC em formato BioC JSON por PMCID.
 *   4. Normalizar os resultados para consumo futuro pelo motor.
 *
 * NÃO:
 *   - diagnostica;
 *   - interpreta ações clínicas;
 *   - altera PatientState;
 *   - pontua o usuário;
 *   - decide condutas.
 *
 * Fluxo:
 *
 *   consulta
 *      ↓
 *   EvidenceResolver
 *      ↓
 *   NCBI
 *      ↓
 *   evidência estruturada
 *
 * ============================================================
 */

(function (global) {
    "use strict";

    class EvidenceResolver {

        constructor(options = {}) {

            this.baseUrl = options.baseUrl ||
                "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

            this.biocBaseUrl = options.biocBaseUrl ||
                "https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful";

            this.tool = options.tool || "Diagnosis";
            this.email = options.email || null;

            this.maxResults = Number(options.maxResults || 5);

            this.lastQuery = null;
            this.lastSearch = null;
        }

        /* ======================================================
           CONFIGURAÇÃO
           ====================================================== */

        buildParams(params = {}) {

            const searchParams = new URLSearchParams();

            for (const [key, value] of Object.entries(params)) {

                if (
                    value === undefined ||
                    value === null ||
                    value === ""
                ) {
                    continue;
                }

                searchParams.set(key, String(value));
            }

            return searchParams.toString();
        }

        buildUrl(endpoint, params = {}) {

            const query = this.buildParams(params);

            return `${this.baseUrl}/${endpoint}${query ? `?${query}` : ""}`;
        }

        /* ======================================================
           PUBMED — ESEARCH
           ====================================================== */

        async searchPubMed(query, options = {}) {

            const text = String(query || "").trim();

            if (!text) {
                throw new Error(
                    "EvidenceResolver.searchPubMed: consulta vazia."
                );
            }

            const retmax = Number(
                options.retmax ||
                this.maxResults
            );

            const retstart = Number(
                options.retstart || 0
            );

            const url = this.buildUrl("esearch.fcgi", {
                db: "pubmed",
                term: text,
                retmode: "json",
                retmax,
                retstart,
                tool: this.tool,
                email: this.email
            });

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(
                    `NCBI ESearch retornou HTTP ${response.status}.`
                );
            }

            const data = await response.json();

            const result = data?.esearchresult || {};

            const normalized = {
                query: text,
                database: "pubmed",
                count: Number(result.count || 0),
                retmax: Number(result.retmax || retmax),
                retstart: Number(result.retstart || retstart),
                pmids: Array.isArray(result.idlist)
                    ? result.idlist
                    : [],
                translation: result.querytranslation || null,
                raw: data
            };

            this.lastQuery = text;
            this.lastSearch = normalized;

            return normalized;
        }

        /* ======================================================
           PUBMED — EFETCH
           ====================================================== */

        async fetchPubMed(pmid) {

            const id = String(pmid || "").trim();

            if (!id) {
                throw new Error(
                    "EvidenceResolver.fetchPubMed: PMID vazio."
                );
            }

            const url = this.buildUrl("efetch.fcgi", {
                db: "pubmed",
                id,
                retmode: "xml",
                rettype: "abstract",
                tool: this.tool,
                email: this.email
            });

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Accept": "application/xml, text/xml"
                }
            });

            if (!response.ok) {
                throw new Error(
                    `NCBI EFetch retornou HTTP ${response.status}.`
                );
            }

            const xmlText = await response.text();

            return {
                pmid: id,
                database: "pubmed",
                format: "xml",
                text: xmlText,
                sourceUrl: url
            };
        }

        /* ======================================================
           PMC — BIOC JSON
           ====================================================== */

        async fetchPMC(pmcid) {

            let id = String(pmcid || "").trim();

            if (!id) {
                throw new Error(
                    "EvidenceResolver.fetchPMC: PMCID vazio."
                );
            }

            if (!/^PMC/i.test(id)) {
                id = `PMC${id}`;
            }

            const encodedId = encodeURIComponent(id);

            const url =
                `${this.biocBaseUrl}/pmcoa.cgi/BioC_json/${encodedId}/unicode`;

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(
                    `NCBI BioC retornou HTTP ${response.status}.`
                );
            }

            const data = await response.json();

            return {
                pmcid: id,
                database: "pmc",
                format: "bioc_json",
                data,
                sourceUrl: url
            };
        }

        /* ======================================================
           NORMALIZAÇÃO DE BIOC
           ====================================================== */

        extractBioCPassages(data) {

            const documents =
                Array.isArray(data?.documents)
                    ? data.documents
                    : [];

            const passages = [];

            for (const document of documents) {

                const documentId =
                    document?.id ||
                    document?.infons?.pmcid ||
                    null;

                const documentPassages =
                    Array.isArray(document?.passages)
                        ? document.passages
                        : [];

                for (const passage of documentPassages) {

                    const infons =
                        passage?.infons || {};

                    passages.push({
                        documentId,

                        section:
                            infons.section ||
                            infons.section_type ||
                            null,

                        type:
                            infons.type ||
                            null,

                        title:
                            infons.title ||
                            null,

                        text:
                            passage?.text ||
                            "",

                        offset:
                            passage?.offset ??
                            null,

                        annotations:
                            Array.isArray(passage?.annotations)
                                ? passage.annotations
                                : []
                    });
                }
            }

            return passages;
        }

        /* ======================================================
           RESULTADO UNIFICADO
           ====================================================== */

        async resolveArticle(pmid, options = {}) {

            const pubmed = await this.fetchPubMed(pmid);

            const result = {
                pmid: String(pmid),
                pubmed,
                pmcid: null,
                pmc: null,
                passages: []
            };

            /*
             * Nesta primeira versão não fazemos parsing complexo
             * do XML. O registro bruto fica preservado.
             *
             * O PMCID poderá ser extraído em uma etapa posterior
             * ou fornecido explicitamente pelo chamador.
             */

            if (options.pmcid) {

                const pmc =
                    await this.fetchPMC(options.pmcid);

                result.pmcid = pmc.pmcid;
                result.pmc = pmc;
                result.passages =
                    this.extractBioCPassages(pmc.data);
            }

            return result;
        }

        /* ======================================================
           HEALTH CHECK
           ====================================================== */

        async testConnection() {

            const result =
                await this.searchPubMed(
                    "status epilepticus benzodiazepine",
                    {
                        retmax: 1
                    }
                );

            return {
                ok: true,
                database: result.database,
                count: result.count,
                pmids: result.pmids
            };
        }
    }

    global.EvidenceResolver = EvidenceResolver;

})(window);
