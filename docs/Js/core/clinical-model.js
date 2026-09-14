"use strict";

/**
 * =============================================================
 * DIAGNOSIS
 * Clinical Model
 * =============================================================
 *
 * Responsabilidade:
 *
 * Knowledge Base
 *      ↓
 * Clinical Model
 *
 * Este módulo transforma a Knowledge Base em um modelo clínico
 * navegável pelo restante do Diagnosis.
 *
 * NÃO:
 * - gera pacientes
 * - gera casos
 * - executa gameplay
 * - pontua
 * - decide "resposta correta"
 * - chama API
 * - depende de LLM
 *
 * Ele apenas organiza o espaço clínico.
 * =============================================================
 */

class ClinicalModel {

    constructor(knowledgeBase) {

        if (!knowledgeBase || typeof knowledgeBase !== "object") {
            throw new Error(
                "ClinicalModel: Knowledge Base inválida."
            );
        }

        this.kb = knowledgeBase;

        this.schemaVersion =
            knowledgeBase.schema_version || null;

        this.knowledgeBase =
            knowledgeBase.knowledge_base || {};

        this.domains =
            Array.isArray(knowledgeBase.domains)
                ? knowledgeBase.domains
                : [];

        this.entities =
            Array.isArray(knowledgeBase.entities)
                ? knowledgeBase.entities
                : [];

        this.relationships =
            Array.isArray(knowledgeBase.relationships)
                ? knowledgeBase.relationships
                : [];

        this.clinicalRules =
            Array.isArray(knowledgeBase.clinical_rules)
                ? knowledgeBase.clinical_rules
                : [];

        this.differentialNetwork =
            Array.isArray(knowledgeBase.differential_network)
                ? knowledgeBase.differential_network
                : [];

        this.sources =
            Array.isArray(knowledgeBase.sources)
                ? knowledgeBase.sources
                : [];

        this.conflicts =
            Array.isArray(knowledgeBase.conflicts)
                ? knowledgeBase.conflicts
                : [];

        this.uncertainties =
            Array.isArray(knowledgeBase.uncertainties)
                ? knowledgeBase.uncertainties
                : [];


        /*
         * Índices para acesso rápido.
         */

        this.entityIndex = new Map();

        this.relationshipIndex = new Map();

        this.typeIndex = new Map();

        this.domainIndex = new Map();


        this.buildIndexes();
    }


    /* =========================================================
       INDEXAÇÃO
       ========================================================= */

    buildIndexes() {

        this.indexEntities();

        this.indexRelationships();

        this.indexDomains();
    }


    indexEntities() {

        for (const entity of this.entities) {

            if (!entity || typeof entity !== "object") {
                continue;
            }

            const id =
                entity.id ||
                entity.entity_id ||
                entity.canonical_id ||
                entity.name;

            if (!id) {
                continue;
            }

            this.entityIndex.set(id, entity);


            /*
             * Índice por tipo.
             */

            const type =
                entity.type ||
                entity.entity_type ||
                entity.classification?.type ||
                "unknown";

            if (!this.typeIndex.has(type)) {
                this.typeIndex.set(type, []);
            }

            this.typeIndex.get(type).push(entity);
        }
    }


    indexRelationships() {

        for (const relation of this.relationships) {

            if (!relation || typeof relation !== "object") {
                continue;
            }

            const source =
                relation.source ||
                relation.source_id ||
                relation.from;

            if (!source) {
                continue;
            }

            if (!this.relationshipIndex.has(source)) {
                this.relationshipIndex.set(source, []);
            }

            this.relationshipIndex
                .get(source)
                .push(relation);
        }
    }


    indexDomains() {

        for (const domain of this.domains) {

            if (!domain || typeof domain !== "object") {
                continue;
            }

            const id =
                domain.id ||
                domain.domain_id ||
                domain.name;

            if (!id) {
                continue;
            }

            this.domainIndex.set(id, domain);
        }
    }


    /* =========================================================
       ENTIDADES
       ========================================================= */

    getEntity(id) {

        if (!id) {
            return null;
        }

        return this.entityIndex.get(id) || null;
    }


    getEntities() {

        return [...this.entities];
    }


    getEntitiesByType(type) {

        if (!type) {
            return [];
        }

        return this.typeIndex.get(type) || [];
    }


    findEntity(text) {

        if (!text) {
            return null;
        }

        const query = String(text)
            .trim()
            .toLowerCase();

        /*
         * Primeiro tenta ID / nome exato.
         */

        for (const entity of this.entities) {

            const id = String(
                entity.id ||
                entity.entity_id ||
                entity.canonical_id ||
                ""
            ).toLowerCase();

            const name = String(
                entity.name ||
                entity.label ||
                entity.canonical_name ||
                ""
            ).toLowerCase();

            if (
                id === query ||
                name === query
            ) {
                return entity;
            }
        }


        /*
         * Depois procura aliases.
         */

        for (const entity of this.entities) {

            const aliases =
                Array.isArray(entity.aliases)
                    ? entity.aliases
                    : [];

            for (const alias of aliases) {

                if (
                    String(alias)
                        .toLowerCase()
                        === query
                ) {
                    return entity;
                }
            }
        }


        return null;
    }


    /* =========================================================
       RELACIONAMENTOS
       ========================================================= */

    getRelationshipsFrom(entityId) {

        if (!entityId) {
            return [];
        }

        return this.relationshipIndex
            .get(entityId) || [];
    }


    getRelationshipsTo(entityId) {

        if (!entityId) {
            return [];
        }

        return this.relationships.filter(
            relation => {

                const target =
                    relation.target ||
                    relation.target_id ||
                    relation.to;

                return target === entityId;
            }
        );
    }


    getRelatedEntities(entityId) {

        const relations =
            this.getRelationshipsFrom(entityId);

        const result = [];

        for (const relation of relations) {

            const target =
                relation.target ||
                relation.target_id ||
                relation.to;

            if (!target) {
                continue;
            }

            const entity =
                this.getEntity(target);

            if (entity) {
                result.push({
                    relationship: relation,
                    entity
                });
            }
        }

        return result;
    }


    getRelationsByType(type) {

        if (!type) {
            return [];
        }

        return this.relationships.filter(
            relation =>
                relation.type === type ||
                relation.relationship === type
        );
    }


    /* =========================================================
       DOMÍNIOS
       ========================================================= */

    getDomain(id) {

        if (!id) {
            return null;
        }

        return this.domainIndex.get(id) || null;
    }


    getDomains() {

        return [...this.domains];
    }


    /* =========================================================
       REGRAS CLÍNICAS
       ========================================================= */

    getClinicalRules() {

        return [...this.clinicalRules];
    }


    getClinicalRulesFor(entityId) {

        if (!entityId) {
            return [];
        }

        return this.clinicalRules.filter(
            rule => {

                const references =
                    ClinicalModel.extractReferences(rule);

                return references.includes(entityId);
            }
        );
    }


    /* =========================================================
       DIFERENCIAL
       ========================================================= */

    getDifferentialNetwork() {

        return [...this.differentialNetwork];
    }


    getDifferentialsFor(entityId) {

        if (!entityId) {
            return [];
        }

        return this.differentialNetwork.filter(
            relation => {

                const references =
                    ClinicalModel.extractReferences(relation);

                return references.includes(entityId);
            }
        );
    }


    /* =========================================================
       REFERÊNCIAS GENÉRICAS
       ========================================================= */

    static extractReferences(object) {

        if (!object || typeof object !== "object") {
            return [];
        }

        const references = [];


        function scan(value) {

            if (typeof value === "string") {

                references.push(value);

                return;
            }


            if (Array.isArray(value)) {

                for (const item of value) {
                    scan(item);
                }

                return;
            }


            if (value && typeof value === "object") {

                for (const key of Object.keys(value)) {

                    /*
                     * Campos que normalmente representam
                     * referências de entidades.
                     */

                    if (
                        key === "id" ||
                        key === "entity_id" ||
                        key === "source" ||
                        key === "source_id" ||
                        key === "target" ||
                        key === "target_id" ||
                        key === "from" ||
                        key === "to" ||
                        key === "entity"
                    ) {
                        scan(value[key]);
                    }

                    else if (
                        key === "entities" ||
                        key === "related_entities" ||
                        key === "references"
                    ) {
                        scan(value[key]);
                    }
                }
            }
        }


        scan(object);

        return [...new Set(references)];
    }


    /* =========================================================
       RESUMO DO MODELO
       ========================================================= */

    summary() {

        return {

            schema_version:
                this.schemaVersion,

            domains:
                this.domains.length,

            entities:
                this.entities.length,

            relationships:
                this.relationships.length,

            clinical_rules:
                this.clinicalRules.length,

            differential_network:
                this.differentialNetwork.length,

            sources:
                this.sources.length,

            conflicts:
                this.conflicts.length,

            uncertainties:
                this.uncertainties.length
        };
    }


    /* =========================================================
       INSPEÇÃO
       ========================================================= */

    inspectEntity(id) {

        const entity =
            this.getEntity(id);

        if (!entity) {
            return null;
        }

        return {

            entity,

            relationshipsFrom:
                this.getRelationshipsFrom(id),

            relationshipsTo:
                this.getRelationshipsTo(id),

            relatedEntities:
                this.getRelatedEntities(id),

            clinicalRules:
                this.getClinicalRulesFor(id),

            differentials:
                this.getDifferentialsFor(id)
        };
    }
}


/* =============================================================
   DISPONIBILIZAÇÃO GLOBAL
   ============================================================= */

window.ClinicalModel = ClinicalModel;
