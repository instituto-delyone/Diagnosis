"use strict";

/**
 * DIAGNOSIS
 * Knowledge Base Loader
 *
 * Responsabilidade:
 * - carregar arquivos JSON
 * - identificar se são Knowledge Base novas ou formato legado
 * - validar a estrutura básica
 * - devolver os dados sem transformá-los em casos
 *
 * NÃO:
 * - gera pacientes
 * - cria casos
 * - interpreta diagnóstico
 * - pontua
 * - executa gameplay
 */

class KnowledgeBaseLoader {

    static detect(data) {

        if (!data || typeof data !== "object") {
            return "unknown";
        }

        // Nova arquitetura de Knowledge Base
        if (
            Array.isArray(data.entities) &&
            Array.isArray(data.relationships)
        ) {
            return "knowledge_base";
        }

        // Estrutura legada
        if (
            Array.isArray(data.casos) ||
            Array.isArray(data.conhecimento) ||
            data.id_caso
        ) {
            return "legacy";
        }

        return "unknown";
    }


    static validate(data) {

        const errors = [];

        if (!data || typeof data !== "object") {
            errors.push("Arquivo não contém um objeto JSON válido.");
            return {
                valid: false,
                errors
            };
        }

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


    static async load(file) {

        const response = await fetch(file, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Não foi possível carregar ${file} (${response.status})`
            );
        }

        const data = await response.json();

        const type = this.detect(data);

        let validation = {
            valid: true,
            errors: []
        };

        if (type === "knowledge_base") {
            validation = this.validate(data);
        }

        return {
            file,
            type,
            valid: validation.valid,
            errors: validation.errors,
            data
        };
    }


    static async loadFiles(files) {

        const results = [];

        for (const file of files) {

            try {

                const result = await this.load(file);

                results.push(result);

            } catch (error) {

                results.push({
                    file,
                    type: "error",
                    valid: false,
                    errors: [error.message],
                    data: null
                });
            }
        }

        return results;
    }


    static summarize(result) {

        if (!result) {
            return null;
        }

        const data = result.data;

        return {
            file: result.file,
            type: result.type,
            valid: result.valid,
            errors: result.errors,

            schema_version:
                data?.schema_version || null,

            domains:
                Array.isArray(data?.domains)
                    ? data.domains.length
                    : 0,

            entities:
                Array.isArray(data?.entities)
                    ? data.entities.length
                    : 0,

            relationships:
                Array.isArray(data?.relationships)
                    ? data.relationships.length
                    : 0,

            clinical_rules:
                Array.isArray(data?.clinical_rules)
                    ? data.clinical_rules.length
                    : 0,

            differential_network:
                Array.isArray(data?.differential_network)
                    ? data.differential_network.length
                    : 0,

            sources:
                Array.isArray(data?.sources)
                    ? data.sources.length
                    : 0
        };
    }
}


// Disponibiliza globalmente para o engine
window.KnowledgeBaseLoader = KnowledgeBaseLoader;
