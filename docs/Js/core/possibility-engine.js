"use strict";

/**
 * =============================================================
 * DIAGNOSIS
 * Possibility Engine
 * =============================================================
 *
 * Responsabilidade:
 *
 * Clinical Model
 *      ↓
 * Possibilities
 *
 * Este módulo NÃO cria um paciente específico.
 *
 * Ele identifica o que pode acontecer clinicamente a partir
 * do conhecimento disponível.
 *
 * Exemplo:
 *
 * doença
 *   ↓
 * manifestações possíveis
 *   ↓
 * achados possíveis
 *   ↓
 * exames possíveis
 *   ↓
 * resultados possíveis
 *   ↓
 * diagnósticos diferenciais
 *   ↓
 * tratamentos possíveis
 *   ↓
 * complicações possíveis
 *
 * O Patient Generator utilizará essas possibilidades depois.
 *
 * NÃO:
 * - cria casos fixos
 * - escolhe um paciente definitivo
 * - pontua
 * - executa gameplay
 * - chama API
 * =============================================================
 */

class PossibilityEngine {

    constructor(clinicalModel) {

        if (!clinicalModel) {
            throw new Error(
                "PossibilityEngine: ClinicalModel não informado."
            );
        }

        this.model = clinicalModel;
    }


    /* =========================================================
       ENTIDADES CLÍNICAS
       ========================================================= */

    getClinicalEntities() {

        return this.model.getEntities();
    }


    getEntitiesByType(type) {

        return this.model.getEntitiesByType(type);
    }


    getDiseaseEntities() {

        const possibleTypes = [
            "disease",
            "condition",
            "disorder",
            "syndrome",
            "diagnosis"
        ];

        const result = [];

        for (const type of possibleTypes) {
            result.push(
                ...this.getEntitiesByType(type)
            );
        }

        /*
         * Compatibilidade com bases que usam `category` em vez de
         * `type` (por exemplo, category: diagnosis) ou que trazem
         * apresentações clínicas diretamente na entidade.
         *
         * Isto não cria doenças novas; apenas reconhece uma entidade
         * clínica que já existe na KB.
         */
        for (const entity of this.model.getEntities()) {

            if (!entity || typeof entity !== "object") {
                continue;
            }

            const category =
                String(entity.category || "").toLowerCase();

            const type =
                String(entity.type || "").toLowerCase();

            const looksClinical =
                category === "diagnosis" ||
                category === "disease" ||
                ["disease", "condition", "disorder", "syndrome", "diagnosis"]
                    .includes(type) ||
                Array.isArray(entity.presentations) ||
                entity.patient_generation?.possible_presentations ||
                entity.clinical;

            if (looksClinical) {
                result.push(entity);
            }
        }

        return this.uniqueEntities(result);
    }


    getSymptomEntities() {

        const possibleTypes = [
            "symptom",
            "sign",
            "finding",
            "clinical_finding"
        ];

        const result = [];

        for (const type of possibleTypes) {

            result.push(
                ...this.getEntitiesByType(type)
            );
        }

        return this.uniqueEntities(result);
    }


    getInvestigationEntities() {

        const possibleTypes = [
            "investigation",
            "laboratory",
            "lab",
            "imaging",
            "exam",
            "test"
        ];

        const result = [];

        for (const type of possibleTypes) {

            result.push(
                ...this.getEntitiesByType(type)
            );
        }

        return this.uniqueEntities(result);
    }


    getTreatmentEntities() {

        const possibleTypes = [
            "treatment",
            "intervention",
            "procedure",
            "medication"
        ];

        const result = [];

        for (const type of possibleTypes) {

            result.push(
                ...this.getEntitiesByType(type)
            );
        }

        return this.uniqueEntities(result);
    }


    /* =========================================================
       RELAÇÕES
       ========================================================= */

    getRelationsFor(entityId) {

        return this.model.getRelationshipsFrom(
            entityId
        );
    }


    getRelatedEntities(entityId) {

        return this.model.getRelatedEntities(
            entityId
        );
    }


    getRelationsByType(type) {

        return this.model.getRelationsByType(
            type
        );
    }


    /* =========================================================
       MANIFESTAÇÕES
       ========================================================= */

    getPossibleManifestations(entityId) {

        const relations =
            this.getRelationsFor(entityId);

        const manifestationRelations = [
            "characterized_by",
            "manifests_as",
            "presents_with",
            "associated_with",
            "results_in",
            "leads_to"
        ];

        const result = [];

        for (const relation of relations) {

            const type =
                relation.type ||
                relation.relationship;

            if (
                !manifestationRelations.includes(type)
            ) {
                continue;
            }

            const target =
                relation.target ||
                relation.target_id ||
                relation.to;

            if (!target) {
                continue;
            }

            const entity =
                this.model.getEntity(target);

            if (entity) {

                result.push({
                    entity,
                    relationship: relation
                });
            }
        }

        /*
         * Algumas KBs representam manifestações diretamente na entidade
         * em vez de criar uma relationship para cada uma.
         */
        const source = this.model.getEntity(entityId);

        if (source && Array.isArray(source.manifestations)) {

            for (const manifestation of source.manifestations) {

                if (manifestation === null || manifestation === undefined) {
                    continue;
                }

                const entity =
                    typeof manifestation === "string"
                        ? {
                            id: manifestation,
                            name: manifestation,
                            type: "symptom"
                        }
                        : manifestation;

                result.push({
                    entity,
                    relationship: {
                        type: "manifests_as",
                        source: entityId
                    }
                });
            }
        }

        /*
         * Formato alternativo: a entidade contém apresentações
         * estruturadas (ex.: neurologia).
         */
        if (source && Array.isArray(source.presentations)) {

            for (const presentation of source.presentations) {

                const findings =
                    Array.isArray(presentation?.findings)
                        ? presentation.findings
                        : [];

                for (const finding of findings) {

                    const id =
                        typeof finding === "string"
                            ? finding
                            : finding?.id;

                    if (!id) continue;

                    result.push({
                        entity: {
                            id,
                            name: id,
                            type: "finding"
                        },
                        relationship: {
                            type: "presents_with",
                            source: entityId,
                            presentation: presentation.id || null,
                            probability: finding?.probability ?? null
                        }
                    });
                }
            }
        }

        /*
         * Formato alternativo: patient_generation.possible_presentations.
         */
        const generatedPresentations =
            source?.patient_generation?.possible_presentations;

        if (Array.isArray(generatedPresentations)) {

            for (const presentation of generatedPresentations) {

                const features =
                    Array.isArray(presentation?.features)
                        ? presentation.features
                        : [];

                for (const feature of features) {
                    if (!feature) continue;

                    result.push({
                        entity: {
                            id: String(feature),
                            name: String(feature),
                            type: "finding"
                        },
                        relationship: {
                            type: "presents_with",
                            source: entityId,
                            presentation: presentation
                        }
                    });
                }
            }
        }

        return this.uniqueRelationEntities(result);
    }


    /* =========================================================
       FATORES DE RISCO / ETIOLOGIA
       ========================================================= */

    getRiskFactors(entityId) {

        return this.getRelatedByTypes(
            entityId,
            [
                "risk_factor",
                "etiology",
                "predisposes_to",
                "increases_risk_of"
            ]
        );
    }


    getEtiologies(entityId) {

        return this.getRelatedByTypes(
            entityId,
            [
                "etiology",
                "cause",
                "associated_with"
            ]
        );
    }


    /* =========================================================
       FISIOPATOLOGIA
       ========================================================= */

    getPathophysiology(entityId) {

        const entity =
            this.model.getEntity(entityId);

        if (!entity) {
            return null;
        }

        return (
            entity.pathophysiology ||
            entity.pathophysiology_profile ||
            entity.mechanisms ||
            entity.mechanism ||
            null
        );
    }


    getMechanisms(entityId) {

        const entity =
            this.model.getEntity(entityId);

        if (!entity) {
            return [];
        }

        if (Array.isArray(entity.mechanisms)) {
            return entity.mechanisms;
        }

        if (Array.isArray(entity.mechanism)) {
            return entity.mechanism;
        }

        if (entity.mechanism) {
            return [entity.mechanism];
        }

        return [];
    }


    /* =========================================================
       EXAMES
       ========================================================= */

    getPossibleInvestigations(entityId) {

        const relations =
            this.getRelationsFor(entityId);

        const investigationRelations = [
            "requires",
            "investigated_by",
            "evaluated_by",
            "diagnosed_by",
            "supports_diagnosis_of"
        ];

        const result = [];

        for (const relation of relations) {

            const type =
                relation.type ||
                relation.relationship;

            if (
                !investigationRelations.includes(type)
            ) {
                continue;
            }

            const target =
                relation.target ||
                relation.target_id ||
                relation.to;

            if (!target) {
                continue;
            }

            const entity =
                this.model.getEntity(target);

            if (entity) {

                result.push({
                    entity,
                    relationship: relation
                });
            }
        }

        /*
         * Também procura entidades de investigação
         * diretamente associadas à condição.
         */

        const direct =
            this.getInvestigationEntities()
                .filter(exam => {

                    const references =
                        ClinicalModel.extractReferences(exam);

                    return references.includes(entityId);
                });

        for (const exam of direct) {

            result.push({
                entity: exam,
                relationship: null
            });
        }

        return this.uniqueRelationEntities(result);
    }


    /* =========================================================
       RESULTADOS POSSÍVEIS
       ========================================================= */

    getPossibleFindings(entityId) {

        const entity =
            this.model.getEntity(entityId);

        if (!entity) {
            return [];
        }

        const result = [];

        const possibleFields = [
            "clinical_profile",
            "clinical_patterns",
            "patterns",
            "findings",
            "manifestations",
            "laboratory_patterns",
            "imaging_patterns",
            "presentation_possibilities"
        ];

        for (const field of possibleFields) {

            if (entity[field]) {

                const value =
                    entity[field];

                if (Array.isArray(value)) {
                    result.push(...value);
                }

                else if (
                    typeof value === "object"
                ) {
                    result.push(value);
                }
            }
        }

        return result;
    }


    /* =========================================================
       DIAGNÓSTICO DIFERENCIAL
       ========================================================= */

    getDifferentials(entityId) {

        return this.model.getDifferentialsFor(
            entityId
        );
    }


    getDifferentialEntities(entityId) {

        const relations =
            this.getDifferentials(entityId);

        const result = [];

        for (const relation of relations) {

            const references =
                ClinicalModel.extractReferences(
                    relation
                );

            for (const reference of references) {

                const entity =
                    this.model.getEntity(
                        reference
                    );

                if (entity) {

                    result.push({
                        entity,
                        relationship: relation
                    });
                }
            }
        }

        return this.uniqueRelationEntities(result);
    }


    /* =========================================================
       TRATAMENTO
       ========================================================= */

    getPossibleTreatments(entityId) {

        const relations =
            this.getRelationsFor(entityId);

        const treatmentRelations = [
            "treated_by",
            "managed_by",
            "requires",
            "indicated_for"
        ];

        const result = [];

        for (const relation of relations) {

            const type =
                relation.type ||
                relation.relationship;

            if (
                !treatmentRelations.includes(type)
            ) {
                continue;
            }

            const target =
                relation.target ||
                relation.target_id ||
                relation.to;

            if (!target) {
                continue;
            }

            const entity =
                this.model.getEntity(target);

            if (entity) {

                result.push({
                    entity,
                    relationship: relation
                });
            }
        }

        /*
         * Procura também referências diretas
         * dentro das entidades.
         */

        const treatments =
            this.getTreatmentEntities();

        for (const treatment of treatments) {

            const references =
                ClinicalModel.extractReferences(
                    treatment
                );

            if (
                references.includes(entityId)
            ) {

                result.push({
                    entity: treatment,
                    relationship: null
                });
            }
        }

        return this.uniqueRelationEntities(result);
    }


    /* =========================================================
       COMPLICAÇÕES
       ========================================================= */

    getPossibleComplications(entityId) {

        return this.getRelatedByTypes(
            entityId,
            [
                "complicates",
                "complicated_by",
                "leads_to",
                "results_in"
            ]
        );
    }


    /* =========================================================
       PROGNÓSTICO / EVOLUÇÃO
       ========================================================= */

    getEvolution(entityId) {

        const entity =
            this.model.getEntity(entityId);

        if (!entity) {
            return null;
        }

        return (
            entity.evolution ||
            entity.prognosis ||
            entity.follow_up ||
            entity.followup ||
            null
        );
    }


    /* =========================================================
       POSSIBILIDADE CLÍNICA COMPLETA
       ========================================================= */

    buildClinicalPossibility(entityId) {

        const entity =
            this.model.getEntity(entityId);

        if (!entity) {
            return null;
        }

        return {

            entity,

            riskFactors:
                this.getRiskFactors(entityId),

            etiologies:
                this.getEtiologies(entityId),

            manifestations:
                this.getPossibleManifestations(
                    entityId
                ),

            findings:
                this.getPossibleFindings(
                    entityId
                ),

            pathophysiology:
                this.getPathophysiology(
                    entityId
                ),

            mechanisms:
                this.getMechanisms(
                    entityId
                ),

            investigations:
                this.getPossibleInvestigations(
                    entityId
                ),

            differentials:
                this.getDifferentialEntities(
                    entityId
                ),

            treatments:
                this.getPossibleTreatments(
                    entityId
                ),

            complications:
                this.getPossibleComplications(
                    entityId
                ),

            evolution:
                this.getEvolution(
                    entityId
                )
        };
    }


    /* =========================================================
       CATÁLOGO DE POSSIBILIDADES
       ========================================================= */

    buildPossibilityCatalog() {

        const diseases =
            this.getDiseaseEntities();

        return diseases.map(
            disease => {

                const id =
                    disease.id ||
                    disease.entity_id ||
                    disease.canonical_id;

                return this.buildClinicalPossibility(
                    id
                );
            }
        ).filter(Boolean);
    }


    /* =========================================================
       UTILITÁRIOS
       ========================================================= */

    getRelatedByTypes(entityId, types) {

        const relations =
            this.getRelationsFor(entityId);

        const result = [];

        for (const relation of relations) {

            const relationType =
                relation.type ||
                relation.relationship;

            if (
                !types.includes(relationType)
            ) {
                continue;
            }

            const target =
                relation.target ||
                relation.target_id ||
                relation.to;

            if (!target) {
                continue;
            }

            const entity =
                this.model.getEntity(target);

            if (entity) {

                result.push({
                    entity,
                    relationship: relation
                });
            }
        }

        return this.uniqueRelationEntities(result);
    }


    uniqueEntities(entities) {

        const seen = new Set();
        const result = [];

        for (const entity of entities) {

            if (!entity) {
                continue;
            }

            const id =
                entity.id ||
                entity.entity_id ||
                entity.canonical_id ||
                entity.name;

            if (!id || seen.has(id)) {
                continue;
            }

            seen.add(id);
            result.push(entity);
        }

        return result;
    }


    uniqueRelationEntities(items) {

        const seen = new Set();
        const result = [];

        for (const item of items) {

            if (!item || !item.entity) {
                continue;
            }

            const id =
                item.entity.id ||
                item.entity.entity_id ||
                item.entity.canonical_id ||
                item.entity.name;

            if (!id || seen.has(id)) {
                continue;
            }

            seen.add(id);
            result.push(item);
        }

        return result;
    }


    /* =========================================================
       RESUMO
       ========================================================= */

    summary() {

        const diseases =
            this.getDiseaseEntities();

        return {

            diseases:
                diseases.length,

            symptoms:
                this.getSymptomEntities().length,

            investigations:
                this.getInvestigationEntities().length,

            treatments:
                this.getTreatmentEntities().length,

            relationships:
                this.model.relationships.length,

            clinicalRules:
                this.model.clinicalRules.length,

            differentials:
                this.model.differentialNetwork.length
        };
    }
}


/* =============================================================
   DISPONIBILIZAÇÃO GLOBAL
   ============================================================= */

window.PossibilityEngine = PossibilityEngine;
