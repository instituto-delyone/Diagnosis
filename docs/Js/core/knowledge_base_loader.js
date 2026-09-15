"use strict";

/**
 * DIAGNOSIS
 * Knowledge Base Loader
 *
 * Responsabilidade:
 *
 * - carregar arquivos JSON de Knowledge Base
 * - identificar KB nova, formato legado ou desconhecido
 * - validar estrutura básica
 * - carregar índice da biblioteca de conhecimento
 * - localizar módulos de conhecimento
 * - resolver caminhos locais e remotos
 * - manter compatibilidade com a arquitetura atual
 *
 * NÃO:
 *
 * - gera pacientes
 * - cria casos
 * - interpreta diagnóstico
 * - pontua
 * - executa gameplay
 * - realiza inferência clínica
 *
 * Arquitetura:
 *
 *      SOURCE
 *        ↓
 *   INDEX / JSON
 *        ↓
 * KnowledgeBaseLoader
 *        ↓
 * ClinicalModel
 *
 * O Loader é uma camada de infraestrutura.
 * Ele transporta conhecimento.
 * Ele não decide o que o conhecimento significa clinicamente.
 */

class KnowledgeBaseLoader {

    /* ============================================================
       CONFIGURAÇÃO
       ============================================================ */

    static get DEFAULT_INDEX_PATH() {
        return "../knowledge_base/index.json";
    }


    static get DEFAULT_KNOWLEDGE_BASE_PATH() {
        return "../knowledge_base/";
    }


    static get DEFAULT_CACHE_MODE() {
        return "no-store";
    }


    /* ============================================================
       DETECÇÃO DE FORMATO
       ============================================================ */

    static detect(data) {

        if (!data || typeof data !== "object") {
            return "unknown";
        }

        /*
         * Nova arquitetura de Knowledge Base.
         *
         * A presença simultânea de entities e relationships
         * identifica o formato estruturado.
         */
        if (
            Array.isArray(data.entities) &&
            Array.isArray(data.relationships)
        ) {
            return "knowledge_base";
        }


        /*
         * Estrutura legada.
         */
        if (
            Array.isArray(data.casos) ||
            Array.isArray(data.conhecimento) ||
            data.id_caso
        ) {
            return "legacy";
        }


        /*
         * Algumas bibliotecas podem conter apenas metadados
         * e referências para módulos.
         */
        if (
            Array.isArray(data.knowledge_bases) ||
            Array.isArray(data.modules) ||
            data.modules &&
            typeof data.modules === "object"
        ) {
            return "index";
        }


        return "unknown";
    }


    /* ============================================================
       VALIDAÇÃO DA KNOWLEDGE BASE
       ============================================================ */

    static validate(data) {

        const errors = [];


        if (!data || typeof data !== "object") {

            errors.push(
                "Arquivo não contém um objeto JSON válido."
            );

            return {
                valid: false,
                errors
            };
        }


        /*
         * Campos fundamentais da arquitetura atual.
         *
         * Não exigimos campos internos específicos das entidades,
         * pois diferentes especialidades podem utilizar campos
         * complementares.
         */
        const requiredArrays = [
            "domains",
            "entities",
            "relationships",
            "clinical_rules",
            "differential_network",
            "sources",
            "conflicts",
            "uncertainties"
        ];


        for (const field of requiredArrays) {

            if (!Array.isArray(data[field])) {

                errors.push(
                    `Campo obrigatório ausente ou inválido: ${field}`
                );
            }
        }


        if (
            !data.knowledge_base ||
            typeof data.knowledge_base !== "object"
        ) {

            errors.push(
                "Campo obrigatório ausente ou inválido: knowledge_base"
            );
        }


        if (!data.schema_version) {

            errors.push(
                "Campo schema_version não encontrado."
            );
        }


        return {
            valid: errors.length === 0,
            errors
        };
    }


    /* ============================================================
       VALIDAÇÃO DO ÍNDICE
       ============================================================ */

    static validateIndex(data) {

        const errors = [];


        if (!data || typeof data !== "object") {

            errors.push(
                "Índice não contém um objeto JSON válido."
            );

            return {
                valid: false,
                errors
            };
        }


        /*
         * O índice pode utilizar qualquer uma destas formas:

         * knowledge_bases: []
         * modules: []
         * modules: {}
         *
         * Portanto não exigimos uma única representação.
         */

        const hasKnowledgeBases =
            Array.isArray(data.knowledge_bases);

        const hasModulesArray =
            Array.isArray(data.modules);

        const hasModulesObject =
            data.modules &&
            typeof data.modules === "object" &&
            !Array.isArray(data.modules);


        if (
            !hasKnowledgeBases &&
            !hasModulesArray &&
            !hasModulesObject
        ) {

            errors.push(
                "Índice não contém 'knowledge_bases' ou 'modules'."
            );
        }


        return {
            valid: errors.length === 0,
            errors
        };
    }


    /* ============================================================
       RESOLUÇÃO DE URL
       ============================================================ */

    static resolveURL(file, base = null) {

        if (!file) {
            throw new Error(
                "Caminho de arquivo não informado."
            );
        }


        /*
         * URLs absolutas permanecem intactas.
         *
         * Exemplos:
         *
         * https://...
         * http://...
         */
        try {

            const absolute = new URL(file);

            return absolute.toString();

        } catch (error) {

            /*
             * Não é URL absoluta.
             * Continua para resolução relativa.
             */
        }


        /*
         * Se não foi fornecida uma base, usamos a URL da página
         * atual.
         */
        const baseURL =
            base ||
            window.location.href;


        try {

            return new URL(
                file,
                baseURL
            ).toString();

        } catch (error) {

            throw new Error(
                `Não foi possível resolver o caminho da Knowledge Base: ${file}`
            );
        }
    }


    /* ============================================================
       RESOLUÇÃO DE CAMINHO DA KNOWLEDGE BASE
       ============================================================ */

    static resolveKnowledgeBasePath(file, options = {}) {

        if (!file) {
            throw new Error(
                "Arquivo de Knowledge Base não informado."
            );
        }


        /*
         * URL explícita.
         */
        if (
            /^https?:\/\//i.test(file) ||
            /^\/\//.test(file)
        ) {

            return file;
        }


        /*
         * Base explícita fornecida pelo chamador.
         */
        if (options.baseURL) {

            return this.resolveURL(
                file,
                options.baseURL
            );
        }


        /*
         * Caminhos relativos são resolvidos em relação à página.
         */
        return this.resolveURL(file);
    }


    /* ============================================================
       FETCH GENÉRICO
       ============================================================ */

    static async fetchJSON(file, options = {}) {

        const resolvedFile =
            this.resolveKnowledgeBasePath(
                file,
                options
            );


        const cacheMode =
            options.cache ||
            this.DEFAULT_CACHE_MODE;


        const response = await fetch(
            resolvedFile,
            {
                cache: cacheMode,
                headers: {
                    "Accept": "application/json"
                }
            }
        );


        if (!response.ok) {

            throw new Error(
                `Não foi possível carregar ${resolvedFile} (${response.status})`
            );
        }


        try {

            return await response.json();

        } catch (error) {

            throw new Error(
                `O arquivo ${resolvedFile} não contém JSON válido.`
            );
        }
    }


    /* ============================================================
       CARREGAR UMA KNOWLEDGE BASE
       ============================================================ */

    static async load(file, options = {}) {

        const resolvedFile =
            this.resolveKnowledgeBasePath(
                file,
                options
            );


        const data =
            await this.fetchJSON(
                resolvedFile,
                options
            );


        const type =
            this.detect(data);


        let validation = {
            valid: true,
            errors: []
        };


        if (type === "knowledge_base") {

            validation =
                this.validate(data);

        } else if (type === "index") {

            validation =
                this.validateIndex(data);
        }


        return {
            file,
            resolvedFile,
            type,
            valid: validation.valid,
            errors: validation.errors,
            data
        };
    }


    /* ============================================================
       CARREGAR VÁRIAS KNOWLEDGE BASES
       ============================================================ */

    static async loadFiles(files, options = {}) {

        const results = [];


        if (!Array.isArray(files)) {

            return [{
                file: null,
                type: "error",
                valid: false,
                errors: [
                    "A lista de arquivos deve ser um array."
                ],
                data: null
            }];
        }


        for (const file of files) {

            try {

                const result =
                    await this.load(
                        file,
                        options
                    );


                results.push(result);

            } catch (error) {

                results.push({

                    file,

                    type: "error",

                    valid: false,

                    errors: [
                        error.message
                    ],

                    data: null
                });
            }
        }


        return results;
    }


    /* ============================================================
       CARREGAR ÍNDICE DA BIBLIOTECA
       ============================================================ */

    static async loadIndex(
        indexPath = null,
        options = {}
    ) {

        const file =
            indexPath ||
            this.DEFAULT_INDEX_PATH;


        const result =
            await this.load(
                file,
                options
            );


        if (result.type !== "index") {

            /*
             * Permitimos que um índice simples seja aceito mesmo
             * que não tenha sido detectado formalmente como "index".
             */
            const validation =
                this.validateIndex(
                    result.data
                );


            if (!validation.valid) {

                throw new Error(
                    `Índice de Knowledge Base inválido: ${validation.errors.join("; ")}`
                );
            }


            result.type = "index";
            result.valid = validation.valid;
            result.errors = validation.errors;
        }


        return result;
    }


    /* ============================================================
       NORMALIZAÇÃO DO ÍNDICE
       ============================================================ */

    static normalizeIndex(indexData) {

        if (
            !indexData ||
            typeof indexData !== "object"
        ) {

            return {
                version: null,
                entries: []
            };
        }


        const entries = [];


        /*
         * Formato:
         *
         * {
         *   "knowledge_bases": [...]
         * }
         */
        if (
            Array.isArray(
                indexData.knowledge_bases
            )
        ) {

            for (
                const item
                of indexData.knowledge_bases
            ) {

                entries.push(
                    this.normalizeIndexEntry(item)
                );
            }
        }


        /*
         * Formato:
         *
         * {
         *   "modules": [...]
         * }
         */
        if (
            Array.isArray(
                indexData.modules
            )
        ) {

            for (
                const item
                of indexData.modules
            ) {

                entries.push(
                    this.normalizeIndexEntry(item)
                );
            }
        }


        /*
         * Formato:

         * {
         *   "modules": {
         *      "dispneia": "dispneia.json"
         *   }
         * }
         */
        if (
            indexData.modules &&
            typeof indexData.modules === "object" &&
            !Array.isArray(indexData.modules)
        ) {

            for (
                const [
                    key,
                    value
                ]
                of Object.entries(
                    indexData.modules
                )
            ) {

                if (
                    typeof value === "string"
                ) {

                    entries.push({

                        id: key,

                        file: value,

                        domains: [],

                        name: key
                    });

                } else if (
                    value &&
                    typeof value === "object"
                ) {

                    entries.push(
                        this.normalizeIndexEntry({
                            ...value,
                            id:
                                value.id ||
                                key
                        })
                    );
                }
            }
        }


        /*
         * Remove duplicidades pelo arquivo/id.
         */
        const unique = [];

        const seen = new Set();


        for (const entry of entries) {

            const key =
                `${entry.id || ""}|${entry.file || ""}`;


            if (seen.has(key)) {
                continue;
            }


            seen.add(key);

            unique.push(entry);
        }


        return {

            version:
                indexData.version ||
                indexData.schema_version ||
                null,

            entries: unique
        };
    }


    /* ============================================================
       NORMALIZAÇÃO DE UMA ENTRADA DO ÍNDICE
       ============================================================ */

    static normalizeIndexEntry(item) {

        if (!item) {

            return {
                id: null,
                name: null,
                file: null,
                domains: []
            };
        }


        if (typeof item === "string") {

            return {

                id: this.extractFileId(item),

                name: this.extractFileId(item),

                file: item,

                domains: []
            };
        }


        return {

            id:
                item.id ||
                item.key ||
                item.slug ||
                null,

            name:
                item.name ||
                item.title ||
                item.id ||
                item.key ||
                null,

            file:
                item.file ||
                item.path ||
                item.url ||
                item.source ||
                null,

            domains:
                Array.isArray(item.domains)
                    ? item.domains
                    : (
                        item.domain
                            ? [item.domain]
                            : []
                    ),

            description:
                item.description ||
                null,

            version:
                item.version ||
                item.schema_version ||
                null,

            metadata:
                item.metadata ||
                {}
        };
    }


    /* ============================================================
       EXTRAIR ID DO ARQUIVO
       ============================================================ */

    static extractFileId(file) {

        if (!file) {
            return null;
        }


        const normalized =
            String(file)
                .split("/")
                .pop()
                .replace(
                    /\.json$/i,
                    ""
                );


        return normalized;
    }


    /* ============================================================
       LOCALIZAR MÓDULO NO ÍNDICE
       ============================================================ */

    static findInIndex(
        indexData,
        query
    ) {

        if (
            !indexData ||
            !query
        ) {

            return null;
        }


        const normalizedIndex =
            this.normalizeIndex(
                indexData
            );


        const normalizedQuery =
            this.normalizeText(
                query
            );


        /*
         * Primeiro: ID exato.
         */
        const exactId =
            normalizedIndex.entries.find(
                entry =>
                    this.normalizeText(
                        entry.id
                    ) === normalizedQuery
            );


        if (exactId) {
            return exactId;
        }


        /*
         * Segundo: arquivo exato.
         */
        const exactFile =
            normalizedIndex.entries.find(
                entry =>
                    this.normalizeText(
                        entry.file
                    ) === normalizedQuery
            );


        if (exactFile) {
            return exactFile;
        }


        /*
         * Terceiro: nome.
         */
        const exactName =
            normalizedIndex.entries.find(
                entry =>
                    this.normalizeText(
                        entry.name
                    ) === normalizedQuery
            );


        if (exactName) {
            return exactName;
        }


        /*
         * Quarto: domínio.
         */
        const domainMatch =
            normalizedIndex.entries.find(
                entry =>
                    Array.isArray(
                        entry.domains
                    ) &&
                    entry.domains.some(
                        domain =>
                            this.normalizeText(
                                domain
                            ) === normalizedQuery
                    )
            );


        if (domainMatch) {
            return domainMatch;
        }


        /*
         * Quinto: correspondência parcial controlada.
         */
        const partial =
            normalizedIndex.entries.find(
                entry => {

                    const candidates = [

                        entry.id,

                        entry.name,

                        entry.file,

                        ...(Array.isArray(entry.domains)
                            ? entry.domains
                            : [])
                    ];


                    return candidates.some(
                        candidate =>
                            this.normalizeText(
                                candidate
                            ).includes(
                                normalizedQuery
                            )
                    );
                }
            );


        return partial || null;
    }


    /* ============================================================
       LOCALIZAR TODOS OS MÓDULOS DE UM DOMÍNIO
       ============================================================ */

    static findByDomain(
        indexData,
        domain
    ) {

        if (
            !indexData ||
            !domain
        ) {

            return [];
        }


        const normalizedDomain =
            this.normalizeText(
                domain
            );


        const normalizedIndex =
            this.normalizeIndex(
                indexData
            );


        return normalizedIndex.entries.filter(
            entry => {

                if (
                    !Array.isArray(
                        entry.domains
                    )
                ) {

                    return false;
                }


                return entry.domains.some(
                    item =>
                        this.normalizeText(
                            item
                        ) === normalizedDomain
                );
            }
        );
    }


    /* ============================================================
       CARREGAR MÓDULO A PARTIR DO ÍNDICE
       ============================================================ */

    static async loadFromIndex(
        indexData,
        query,
        options = {}
    ) {

        const entry =
            this.findInIndex(
                indexData,
                query
            );


        if (!entry) {

            throw new Error(
                `Nenhum módulo de Knowledge Base encontrado para: ${query}`
            );
        }


        if (!entry.file) {

            throw new Error(
                `O módulo '${entry.id || entry.name || query}' não possui arquivo definido no índice.`
            );
        }


        /*
         * Se a entrada já contém URL absoluta,
         * preservamos.
         *
         * Caso contrário, resolvemos em relação ao índice
         * quando possível.
         */
        let file =
            entry.file;


        if (
            !/^https?:\/\//i.test(file)
        ) {

            const indexBase =
                options.indexBaseURL ||
                options.baseURL ||
                window.location.href;


            file =
                this.resolveURL(
                    file,
                    indexBase
                );
        }


        return this.load(
            file,
            {
                ...options,
                baseURL: file
            }
        );
    }


    /* ============================================================
       CARREGAR MÓDULOS POR DOMÍNIO
       ============================================================ */

    static async loadByDomain(
        indexData,
        domain,
        options = {}
    ) {

        const entries =
            this.findByDomain(
                indexData,
                domain
            );


        const results = [];


        for (
            const entry
            of entries
        ) {

            if (!entry.file) {
                continue;
            }


            try {

                let file =
                    entry.file;


                if (
                    !/^https?:\/\//i.test(file)
                ) {

                    const indexBase =
                        options.indexBaseURL ||
                        options.baseURL ||
                        window.location.href;


                    file =
                        this.resolveURL(
                            file,
                            indexBase
                        );
                }


                const result =
                    await this.load(
                        file,
                        options
                    );


                results.push(result);

            } catch (error) {

                results.push({

                    file:
                        entry.file,

                    type:
                        "error",

                    valid:
                        false,

                    errors: [
                        error.message
                    ],

                    data:
                        null,

                    indexEntry:
                        entry
                });
            }
        }


        return results;
    }


    /* ============================================================
       NORMALIZAÇÃO TEXTUAL
       ============================================================ */

    static normalizeText(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";
        }


        return String(value)
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .toLowerCase()
            .trim()
            .replace(
                /\s+/g,
                " "
            );
    }


    /* ============================================================
       RESUMO
       ============================================================ */

    static summarize(result) {

        if (!result) {
            return null;
        }


        const data =
            result.data;


        return {

            file:
                result.file,

            resolvedFile:
                result.resolvedFile ||
                null,

            type:
                result.type,

            valid:
                result.valid,

            errors:
                result.errors,

            schema_version:
                data?.schema_version ||
                null,

            domains:
                Array.isArray(
                    data?.domains
                )
                    ? data.domains.length
                    : 0,

            entities:
                Array.isArray(
                    data?.entities
                )
                    ? data.entities.length
                    : 0,

            relationships:
                Array.isArray(
                    data?.relationships
                )
                    ? data.relationships.length
                    : 0,

            clinical_rules:
                Array.isArray(
                    data?.clinical_rules
                )
                    ? data.clinical_rules.length
                    : 0,

            differential_network:
                Array.isArray(
                    data?.differential_network
                )
                    ? data.differential_network.length
                    : 0,

            sources:
                Array.isArray(
                    data?.sources
                )
                    ? data.sources.length
                    : 0,

            knowledge_base:
                data?.knowledge_base
                    ? true
                    : false
        };
    }


    /* ============================================================
       RESUMO DE ÍNDICE
       ============================================================ */

    static summarizeIndex(indexData) {

        if (!indexData) {
            return null;
        }


        const normalized =
            this.normalizeIndex(
                indexData
            );


        return {

            version:
                normalized.version,

            modules:
                normalized.entries.length,

            entries:
                normalized.entries.map(
                    entry => ({

                        id:
                            entry.id,

                        name:
                            entry.name,

                        file:
                            entry.file,

                        domains:
                            entry.domains
                    })
                )
        };
    }
}


/* ================================================================
   DISPONIBILIZA GLOBALMENTE PARA O ENGINE
   ================================================================ */

if (
    typeof window !== "undefined"
) {

    window.KnowledgeBaseLoader =
        KnowledgeBaseLoader;
}
