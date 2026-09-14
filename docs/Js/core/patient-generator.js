"use strict";

/**
 * =============================================================
 * DIAGNOSIS
 * Patient Generator
 * =============================================================
 *
 * RESPONSABILIDADE
 *
 * Possibility Engine
 *        ↓
 * Patient Generator
 *        ↓
 * Patient
 *
 * O gerador transforma conhecimento clínico em uma instância
 * específica de paciente.
 *
 * IMPORTANTE:
 * - não usa API
 * - não usa LLM
 * - não cria casos pré-fabricados
 * - não pontua
 * - não executa gameplay
 *
 * A geração é baseada somente no Clinical Model +
 * Possibility Engine.
 * =============================================================
 */

class PatientGenerator {

    constructor(possibilityEngine) {

        if (!possibilityEngine) {
            throw new Error(
                "PatientGenerator: PossibilityEngine não informado."
            );
        }

        this.engine = possibilityEngine;
        this.model = possibilityEngine.model;
    }


    /* =========================================================
       UTILITÁRIOS ALEATÓRIOS
       ========================================================= */

    random() {

        return Math.random();
    }


    randomItem(array) {

        if (!Array.isArray(array) || array.length === 0) {
            return null;
        }

        return array[
            Math.floor(
                this.random() * array.length
            )
        ];
    }


    randomInt(min, max) {

        return Math.floor(
            this.random() * (max - min + 1)
        ) + min;
    }


    chance(probability) {

        return this.random() < probability;
    }


    shuffle(array) {

        const copy = [...array];

        for (
            let i = copy.length - 1;
            i > 0;
            i--
        ) {

            const j =
                Math.floor(
                    this.random() * (i + 1)
                );

            [
                copy[i],
                copy[j]
            ] = [
                copy[j],
                copy[i]
            ];
        }

        return copy;
    }


    /* =========================================================
       IDENTIDADE
       ========================================================= */

    generateId(prefix = "patient") {

        return (
            prefix +
            "_" +
            Date.now().toString(36) +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 8)
        );
    }


    /* =========================================================
       DEMOGRAFIA
       ========================================================= */

    generateDemographics() {

        const sex =
            this.randomItem([
                "female",
                "male"
            ]);

        const age =
            this.randomInt(18, 85);

        return {

            age,

            sex,

            /*
             * Não criamos nome, CPF, endereço ou qualquer
             * identificação pessoal real.
             */

            ageGroup:
                this.getAgeGroup(age)
        };
    }


    getAgeGroup(age) {

        if (age < 18) {
            return "pediatric";
        }

        if (age < 40) {
            return "young_adult";
        }

        if (age < 65) {
            return "middle_aged";
        }

        return "older_adult";
    }


    /* =========================================================
       DOENÇA BASE
       ========================================================= */

    selectDisease() {

        const diseases =
            this.engine.getDiseaseEntities();

        if (diseases.length === 0) {
            return null;
        }

        return this.randomItem(diseases);
    }


    /* =========================================================
       SEVERIDADE
       ========================================================= */

    generateSeverity() {

        const values = [
            "mild",
            "moderate",
            "severe"
        ];

        return this.randomItem(values);
    }


    /* =========================================================
       APRESENTAÇÃO
       ========================================================= */

    generatePresentation(disease) {

        if (!disease) {
            return [];
        }

        const id =
            disease.id ||
            disease.entity_id ||
            disease.canonical_id;

        const manifestations =
            this.engine.getPossibleManifestations(id);

        const findings =
            this.engine.getPossibleFindings(id);

        const candidates = [];


        /*
         * Relações clínicas.
         */

        for (const item of manifestations) {

            if (item.entity) {
                candidates.push({
                    type: "manifestation",
                    source: item.entity,
                    relationship:
                        item.relationship || null
                });
            }
        }


        /*
         * Padrões clínicos estruturados.
         */

        for (const finding of findings) {

            candidates.push({
                type: "finding",
                source: finding
            });
        }


        /*
         * Remove duplicatas simples.
         */

        const unique = [];

        const seen = new Set();

        for (const item of candidates) {

            const key =
                JSON.stringify(item.source);

            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            unique.push(item);
        }


        /*
         * Quantidade variável de manifestações.
         *
         * A ideia é evitar que todo paciente tenha
         * absolutamente tudo descrito na KB.
         */

        const shuffled =
            this.shuffle(unique);

        const count =
            Math.min(
                shuffled.length,
                this.randomInt(
                    2,
                    Math.max(
                        2,
                        Math.min(5, shuffled.length)
                    )
                )
            );

        return shuffled.slice(0, count);
    }


    /* =========================================================
       FATORES DE RISCO
       ========================================================= */

    generateRiskFactors(disease) {

        if (!disease) {
            return [];
        }

        const id =
            disease.id ||
            disease.entity_id ||
            disease.canonical_id;

        const factors =
            this.engine.getRiskFactors(id);

        if (!factors.length) {
            return [];
        }

        /*
         * Nem todo paciente precisa possuir todos os
         * fatores de risco disponíveis.
         */

        return this.shuffle(factors)
            .slice(
                0,
                this.randomInt(
                    0,
                    Math.min(3, factors.length)
                )
            );
    }


    /* =========================================================
       ETIOLOGIA
       ========================================================= */

    generateEtiology(disease) {

        if (!disease) {
            return null;
        }

        const id =
            disease.id ||
            disease.entity_id ||
            disease.canonical_id;

        const etiologies =
            this.engine.getEtiologies(id);

        if (!etiologies.length) {
            return null;
        }

        return this.randomItem(
            etiologies
        );
    }


    /* =========================================================
       EXAMES INICIAIS POSSÍVEIS
       ========================================================= */

    generateInvestigationPossibilities(disease) {

        if (!disease) {
            return [];
        }

        const id =
            disease.id ||
            disease.entity_id ||
            disease.canonical_id;

        return this.engine
            .getPossibleInvestigations(id);
    }


    /* =========================================================
       DIFERENCIAIS
       ========================================================= */

    generateDifferentials(disease) {

        if (!disease) {
            return [];
        }

        const id =
            disease.id ||
            disease.entity_id ||
            disease.canonical_id;

        const differentials =
            this.engine
                .getDifferentialEntities(id);

        return this.shuffle(
            differentials
        ).slice(
            0,
            Math.min(4, differentials.length)
        );
    }


    /* =========================================================
       TRATAMENTOS POSSÍVEIS
       ========================================================= */

    generateTreatmentPossibilities(disease) {

        if (!disease) {
            return [];
        }

        const id =
            disease.id ||
            disease.entity_id ||
            disease.canonical_id;

        return this.engine
            .getPossibleTreatments(id);
    }


    /* =========================================================
       COMPLICAÇÕES
       ========================================================= */

    generateComplications(disease) {

        if (!disease) {
            return [];
        }

        const id =
            disease.id ||
            disease.entity_id ||
            disease.canonical_id;

        const complications =
            this.engine
                .getPossibleComplications(id);

        return this.shuffle(
            complications
        ).slice(
            0,
            Math.min(3, complications.length)
        );
    }


    /* =========================================================
       VITALS INICIAIS
       ========================================================= */

    generateVitals(severity) {

        /*
         * Importante:
         *
         * Não inventamos valores médicos específicos a partir
         * de conhecimento que não esteja na KB.
         *
         * Por enquanto o gerador cria apenas um estado de
         * estabilidade qualitativo.
         *
         * A camada posterior poderá derivar sinais vitais
         * de padrões fisiológicos explicitamente presentes
         * na Knowledge Base.
         */

        let stability = 100;

        if (severity === "moderate") {
            stability = this.randomInt(70, 89);
        }

        if (severity === "severe") {
            stability = this.randomInt(35, 69);
        }

        return {

            stability,

            heartRate: null,

            respiratoryRate: null,

            bloodPressure: null,

            oxygenSaturation: null,

            temperature: null,

            glucose: null
        };
    }


    /* =========================================================
       ESTADO CLÍNICO
       ========================================================= */

    generateClinicalState(
        disease,
        severity
    ) {

        return {

            diseaseId:
                disease?.id ||
                disease?.entity_id ||
                disease?.canonical_id ||
                null,

            severity,

            onset:
                this.randomItem([
                    "acute",
                    "subacute",
                    "chronic"
                ]),

            progression:
                this.randomItem([
                    "stable",
                    "progressive"
                ]),

            diagnosed:
                false,

            treatmentStarted:
                false,

            resolved:
                false
        };
    }


    /* =========================================================
       GERADOR PRINCIPAL
       ========================================================= */

    generate(options = {}) {

        const disease =
            options.disease ||
            this.selectDisease();

        if (!disease) {

            throw new Error(
                "PatientGenerator: nenhuma doença disponível."
            );
        }


        const severity =
            options.severity ||
            this.generateSeverity();


        const demographics =
            this.generateDemographics();


        const presentation =
            this.generatePresentation(
                disease
            );


        const riskFactors =
            this.generateRiskFactors(
                disease
            );


        const etiology =
            this.generateEtiology(
                disease
            );


        const investigations =
            this.generateInvestigationPossibilities(
                disease
            );


        const differentials =
            this.generateDifferentials(
                disease
            );


        const treatments =
            this.generateTreatmentPossibilities(
                disease
            );


        const complications =
            this.generateComplications(
                disease
            );


        const vitals =
            this.generateVitals(
                severity
            );


        const clinicalState =
            this.generateClinicalState(
                disease,
                severity
            );


        return {

            id:
                this.generateId(),

            generatedAt:
                new Date().toISOString(),

            demographics,

            condition: {

                id:
                    disease.id ||
                    disease.entity_id ||
                    disease.canonical_id ||
                    null,

                name:
                    disease.name ||
                    disease.label ||
                    disease.canonical_name ||
                    null
            },

            severity,

            etiology,

            riskFactors,

            presentation,

            investigations,

            differentials,

            treatments,

            complications,

            vitals,

            clinicalState
        };
    }


    /* =========================================================
       GERAÇÃO DE VÁRIOS PACIENTES
       ========================================================= */

    generateMany(count = 1, options = {}) {

        const patients = [];

        for (
            let i = 0;
            i < count;
            i++
        ) {

            patients.push(
                this.generate(options)
            );
        }

        return patients;
    }
}


/* =============================================================
   DISPONIBILIZAÇÃO GLOBAL
   ============================================================= */

window.PatientGenerator = PatientGenerator;
