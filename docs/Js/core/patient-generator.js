"use strict";

/**
 * =============================================================
 * DIAGNOSIS
 * Patient Generator — v2
 * =============================================================
 *
 * RESPONSABILIDADE
 *
 * Possibility Engine
 *        ↓
 * Patient Generator
 *        ↓
 * Patient State
 *        ↓
 * Simulation
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
 *
 *
 * PRINCÍPIO:
 *
 * A doença determina o espaço clínico.
 * O gerador determina a apresentação.
 * O Patient State determina o que é verdadeiro.
 * O Interlocutor determina o que pode ser revelado.
 *
 * A doença pode permanecer oculta.
 * A queixa clínica não pode estar ausente.
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


    getDiseaseId(disease) {

        if (!disease) {
            return null;
        }

        return (
            disease.id ||
            disease.entity_id ||
            disease.canonical_id ||
            null
        );
    }


    getDiseaseName(disease) {

        if (!disease) {
            return null;
        }

        return (
            disease.name ||
            disease.label ||
            disease.canonical_name ||
            null
        );
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
       APRESENTAÇÃO — CANDIDATOS
       =========================================================
       Esta função preserva a lógica original.

       Ela consulta o Possibility Engine e obtém manifestações
       e achados possíveis associados à doença.

       Esses elementos ainda NÃO constituem a queixa principal.
       São matéria-prima para a construção da apresentação.
       ========================================================= */

    generatePresentationCandidates(disease) {

        if (!disease) {
            return [];
        }

        const id =
            this.getDiseaseId(disease);

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
         * Evitamos colocar todos os achados disponíveis no
         * mesmo paciente.
         */

        const shuffled =
            this.shuffle(unique);

        const maxCount =
            Math.min(
                5,
                shuffled.length
            );

        if (maxCount === 0) {
            return [];
        }

        const minCount =
            Math.min(
                2,
                maxCount
            );

        const count =
            this.randomInt(
                minCount,
                maxCount
            );

        return shuffled.slice(
            0,
            count
        );
    }


    /* =========================================================
       NORMALIZAÇÃO DE MANIFESTAÇÕES
       =========================================================
       Converte estruturas diferentes da KB em referências
       clínicas simples.

       IMPORTANTE:
       Não inventa texto médico.
       Apenas tenta extrair identificadores/nomes já existentes.
       ========================================================= */

    normalizeClinicalReference(item) {

        if (!item) {
            return null;
        }

        const source =
            item.source ||
            item.entity ||
            item;

        if (!source) {
            return null;
        }

        if (typeof source === "string") {

            return {
                id: source,
                name: source,
                type: item.type || null
            };
        }

        if (typeof source !== "object") {
            return null;
        }

        const id =
            source.id ||
            source.entity_id ||
            source.canonical_id ||
            source.code ||
            null;

        const name =
            source.name ||
            source.label ||
            source.canonical_name ||
            source.term ||
            source.title ||
            null;

        return {

            id,

            name,

            type:
                item.type ||
                source.type ||
                null,

            relationship:
                item.relationship ||
                null
        };
    }


    /* =========================================================
       SINTOMAS
       =========================================================
       Seleciona manifestações que poderão compor a queixa
       inicial.

       Nesta fase não tentamos decidir automaticamente se um
       achado é sintoma ou sinal por inferência médica.
       A KB poderá posteriormente fornecer essa distinção.
       ========================================================= */

    generateSymptoms(
        presentationCandidates,
        options = {}
    ) {

        if (
            !Array.isArray(
                presentationCandidates
            )
        ) {
            return [];
        }

        const references =
            presentationCandidates
                .map(item =>
                    this.normalizeClinicalReference(item)
                )
                .filter(Boolean);


        const unique = [];

        const seen = new Set();

        for (const reference of references) {

            const key =
                reference.id ||
                reference.name;

            if (!key || seen.has(key)) {
                continue;
            }

            seen.add(key);

            unique.push(reference);
        }


        if (unique.length === 0) {
            return [];
        }


        /*
         * Por padrão, uma apresentação inicial possui
         * 1–3 sintomas/queixas.
         */

        const requestedCount =
            options.symptomCount;

        let count;

        if (
            Number.isInteger(
                requestedCount
            )
        ) {

            count =
                Math.max(
                    1,
                    Math.min(
                        requestedCount,
                        unique.length
                    )
                );

        } else {

            count =
                this.randomInt(
                    1,
                    Math.min(
                        3,
                        unique.length
                    )
                );
        }


        return this.shuffle(
            unique
        ).slice(
            0,
            count
        );
    }


    /* =========================================================
       TEXTO DA QUEIXA
       =========================================================
       Nesta versão o texto narrativo só é construído quando
       houver informação textual suficiente na KB.

       Não inventamos descrições temporais ou características
       clínicas que não estejam disponíveis.
       ========================================================= */

    generateChiefComplaint(
        symptoms,
        options = {}
    ) {

        const validSymptoms =
            Array.isArray(symptoms)
                ? symptoms.filter(
                    symptom =>
                        symptom &&
                        (
                            symptom.name ||
                            symptom.id
                        )
                )
                : [];

        if (
            validSymptoms.length === 0
        ) {

            return {

                symptoms: [],

                narrative:
                    options.narrative ||
                    null
            };
        }


        /*
         * Se futuramente a KB fornecer uma narrativa pronta,
         * ela poderá ser utilizada diretamente.
         */

        const narrative =
            options.narrative ||
            null;


        return {

            symptoms:
                validSymptoms.map(
                    symptom =>
                        symptom.id ||
                        symptom.name
                ),

            narrative
        };
    }


    /* =========================================================
       INÍCIO / ONSET
       ========================================================= */

    generateOnset(
        disease,
        options = {}
    ) {

        /*
         * Se a chamada de geração fornecer explicitamente
         * informações de início, preservamos essas informações.
         */

        if (options.onset) {

            return {
                ...options.onset
            };
        }


        /*
         * Nesta fase ainda não criamos uma duração clínica
         * arbitrária como "há 2 horas".
         *
         * O tipo pode existir como estado estrutural, mas a
         * descrição fica nula até que a KB possua essa informação.
         */

        const type =
            options.onsetType ||
            this.randomItem([
                "acute",
                "subacute",
                "chronic"
            ]);


        return {

            type,

            description:
                null
        };
    }


    /* =========================================================
       CONTEXTO DE CHEGADA
       ========================================================= */

    generatePresentationContext(
        options = {}
    ) {

        return {

            arrival_mode:
                options.arrivalMode ||
                "encaminhado_pela_enfermagem"
        };
    }


    /* =========================================================
       APRESENTAÇÃO CLÍNICA
       =========================================================
       Aqui transformamos os candidatos da KB em uma
       apresentação inicial real do paciente.
       ========================================================= */

    generateClinicalPresentation(
        disease,
        options = {}
    ) {

        const candidates =
            this.generatePresentationCandidates(
                disease
            );


        const symptoms =
            this.generateSymptoms(
                candidates,
                options
            );


        const chiefComplaint =
            this.generateChiefComplaint(
                symptoms,
                options
            );


        const onset =
            this.generateOnset(
                disease,
                options
            );


        const context =
            this.generatePresentationContext(
                options
            );


        return {

            chief_complaint:
                chiefComplaint,

            onset,

            context
        };
    }


    /* =========================================================
       FATORES DE RISCO
       ========================================================= */

    generateRiskFactors(disease) {

        if (!disease) {
            return [];
        }

        const id =
            this.getDiseaseId(disease);

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
                    Math.min(
                        3,
                        factors.length
                    )
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
            this.getDiseaseId(disease);

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
       HISTÓRIA CLÍNICA
       =========================================================
       A estrutura existe desde já, mas os campos permanecem
       vazios até que a Knowledge Base forneça informação
       suficiente para preenchê-los.
       ========================================================= */

    generateHistory(
        disease,
        options = {}
    ) {

        return {

            past_medical_history:
                Array.isArray(
                    options.pastMedicalHistory
                )
                    ? [
                        ...options.pastMedicalHistory
                    ]
                    : [],

            medications:
                Array.isArray(
                    options.medications
                )
                    ? [
                        ...options.medications
                    ]
                    : [],

            allergies:
                Array.isArray(
                    options.allergies
                )
                    ? [
                        ...options.allergies
                    ]
                    : [],

            family_history:
                Array.isArray(
                    options.familyHistory
                )
                    ? [
                        ...options.familyHistory
                    ]
                    : [],

            social_history:
                Array.isArray(
                    options.socialHistory
                )
                    ? [
                        ...options.socialHistory
                    ]
                    : []
        };
    }


    /* =========================================================
       EXAMES INICIAIS POSSÍVEIS
       ========================================================= */

    generateInvestigationPossibilities(disease) {

        if (!disease) {
            return [];
        }

        const id =
            this.getDiseaseId(disease);

        return this.engine
            .getPossibleInvestigations(id);
    }


    /* =========================================================
       INVESTIGAÇÕES DO PACIENTE
       =========================================================
       Possibilidades de investigação e resultados do paciente
       são coisas diferentes.

       O Generator prepara o espaço de investigação.
       O resultado só deverá aparecer quando uma ação clínica
       solicitar a investigação correspondente.
       ========================================================= */

    generateInvestigations(
        disease,
        options = {}
    ) {

        return {

            available:
                this.generateInvestigationPossibilities(
                    disease
                ),

            ordered: [],

            results:
                options.investigationResults ||
                {

                    laboratory: {},

                    ecg: null,

                    imaging: {},

                    other: {}
                }
        };
    }


    /* =========================================================
       EXAME FÍSICO
       ========================================================= */

    generatePhysicalExam(
        options = {}
    ) {

        return {

            general:
                options.physicalExam?.general ||
                {},

            cardiovascular:
                options.physicalExam?.cardiovascular ||
                {},

            respiratory:
                options.physicalExam?.respiratory ||
                {},

            neurologic:
                options.physicalExam?.neurologic ||
                {},

            other:
                options.physicalExam?.other ||
                {}
        };
    }


    /* =========================================================
       DIFERENCIAIS
       ========================================================= */

    generateDifferentials(disease) {

        if (!disease) {
            return [];
        }

        const id =
            this.getDiseaseId(disease);

        const differentials =
            this.engine
                .getDifferentialEntities(id);

        return this.shuffle(
            differentials
        ).slice(
            0,
            Math.min(
                4,
                differentials.length
            )
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
            this.getDiseaseId(disease);

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
            this.getDiseaseId(disease);

        const complications =
            this.engine
                .getPossibleComplications(id);

        return this.shuffle(
            complications
        ).slice(
            0,
            Math.min(
                3,
                complications.length
            )
        );
    }


    /* =========================================================
       VITAIS INICIAIS
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
            stability =
                this.randomInt(
                    70,
                    89
                );
        }

        if (severity === "severe") {
            stability =
                this.randomInt(
                    35,
                    69
                );
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
       HIDDEN STATE
       =========================================================
       Este objeto contém aquilo que é verdadeiro sobre o
       paciente, mas que NÃO deve ser apresentado diretamente
       ao jogador.
       ========================================================= */

    generateHiddenState(
        disease,
        severity,
        options = {}
    ) {

        return {

            diagnosis:
                this.getDiseaseId(
                    disease
                ),

            severity,

            pathophysiology:
                options.pathophysiology ||
                {},

            complications:
                Array.isArray(
                    options.hiddenComplications
                )
                    ? [
                        ...options.hiddenComplications
                    ]
                    : [],

            evolution:
                options.evolution ||
                {}
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
                this.getDiseaseId(
                    disease
                ),

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
       PATIENT STATE
       =========================================================
       Estrutura central do paciente.

       Esta camada representa o estado clínico verdadeiro.
       ========================================================= */

    generatePatientState(
        disease,
        severity,
        presentation,
        history,
        vitals,
        physicalExam,
        investigations,
        options = {}
    ) {

        return {

            id:
                this.generateId(),

            demographics:
                options.demographics ||
                null,

            presentation,

            history,

            vitals,

            physical_exam:
                physicalExam,

            investigations,

            hidden_state:
                this.generateHiddenState(
                    disease,
                    severity,
                    options
                )
        };
    }


    /* =========================================================
       GERADOR PRINCIPAL
       ========================================================= */

    generate(options = {}) {

        /*
         * -----------------------------------------------------
         * 1. DOENÇA
         * -----------------------------------------------------
         */

        const disease =
            options.disease ||
            this.selectDisease();

        if (!disease) {

            throw new Error(
                "PatientGenerator: nenhuma doença disponível."
            );
        }


        /*
         * -----------------------------------------------------
         * 2. SEVERIDADE
         * -----------------------------------------------------
         */

        const severity =
            options.severity ||
            this.generateSeverity();


        /*
         * -----------------------------------------------------
         * 3. DEMOGRAFIA
         * -----------------------------------------------------
         */

        const demographics =
            options.demographics ||
            this.generateDemographics();


        /*
         * -----------------------------------------------------
         * 4. APRESENTAÇÃO CLÍNICA
         * -----------------------------------------------------
         */

        const presentation =
            this.generateClinicalPresentation(
                disease,
                options
            );


        /*
         * -----------------------------------------------------
         * 5. HISTÓRIA
         * -----------------------------------------------------
         */

        const history =
            this.generateHistory(
                disease,
                options
            );


        /*
         * -----------------------------------------------------
         * 6. FATORES DE RISCO
         * -----------------------------------------------------
         */

        const riskFactors =
            this.generateRiskFactors(
                disease
            );


        /*
         * -----------------------------------------------------
         * 7. ETIOLOGIA
         * -----------------------------------------------------
         */

        const etiology =
            this.generateEtiology(
                disease
            );


        /*
         * -----------------------------------------------------
         * 8. INVESTIGAÇÕES
         * -----------------------------------------------------
         */

        const investigations =
            this.generateInvestigations(
                disease,
                options
            );


        /*
         * -----------------------------------------------------
         * 9. DIFERENCIAIS
         * -----------------------------------------------------
         */

        const differentials =
            this.generateDifferentials(
                disease
            );


        /*
         * -----------------------------------------------------
         * 10. TRATAMENTOS
         * -----------------------------------------------------
         */

        const treatments =
            this.generateTreatmentPossibilities(
                disease
            );


        /*
         * -----------------------------------------------------
         * 11. COMPLICAÇÕES
         * -----------------------------------------------------
         */

        const complications =
            this.generateComplications(
                disease
            );


        /*
         * -----------------------------------------------------
         * 12. VITAIS
         * -----------------------------------------------------
         */

        const vitals =
            this.generateVitals(
                severity
            );


        /*
         * -----------------------------------------------------
         * 13. EXAME FÍSICO
         * -----------------------------------------------------
         */

        const physicalExam =
            this.generatePhysicalExam(
                options
            );


        /*
         * -----------------------------------------------------
         * 14. ESTADO CLÍNICO
         * -----------------------------------------------------
         */

        const clinicalState =
            this.generateClinicalState(
                disease,
                severity
            );


        /*
         * -----------------------------------------------------
         * 15. PATIENT STATE
         * -----------------------------------------------------
         */

        const patientState =
            this.generatePatientState(
                disease,
                severity,
                presentation,
                history,
                vitals,
                physicalExam,
                investigations,
                {
                    ...options,

                    demographics
                }
            );


        /*
         * -----------------------------------------------------
         * 16. PACIENTE FINAL
         * -----------------------------------------------------
         *
         * condition continua existindo para o motor interno.
         *
         * Ela NÃO deve ser utilizada diretamente pela UI
         * como informação apresentada ao jogador.
         * -----------------------------------------------------
         */

        return {

            id:
                patientState.id,

            generatedAt:
                new Date().toISOString(),

            demographics,

            /*
             * A doença continua presente no estado interno
             * para permitir avaliação, evolução e resolução.
             */
            condition: {

                id:
                    this.getDiseaseId(
                        disease
                    ),

                name:
                    this.getDiseaseName(
                        disease
                    )
            },

            severity,

            etiology,

            riskFactors,

            /*
             * Nova apresentação clínica estruturada.
             */
            presentation,

            history,

            physical_exam:
                physicalExam,

            investigations,

            differentials,

            treatments,

            complications,

            vitals,

            /*
             * Estado verdadeiro do paciente.
             */
            hidden_state:
                patientState.hidden_state,

            clinicalState
        };
    }


    /* =========================================================
       GERAÇÃO DE VÁRIOS PACIENTES
       ========================================================= */

    generateMany(
        count = 1,
        options = {}
    ) {

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

window.PatientGenerator =
    PatientGenerator;
