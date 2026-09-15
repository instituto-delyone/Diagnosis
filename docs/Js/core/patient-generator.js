"use strict";

/**
 * =============================================================
 * DIAGNOSIS
 * Patient Generator — v2.1
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
 * PRINCÍPIO:
 *
 * A doença determina o espaço clínico.
 * O Knowledge fornece a apresentação possível.
 * O Generator instancia uma apresentação.
 * O Patient State mantém o que é verdadeiro.
 * O Interlocutor revela apenas o que for solicitado.
 *
 * A doença pode estar oculta.
 * A apresentação clínica não.
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

        if (!Array.isArray(array)) {
            return [];
        }

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

        if (!Array.isArray(diseases) || diseases.length === 0) {
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
       APRESENTAÇÃO CLÍNICA
       =========================================================
       O Knowledge é a fonte da apresentação.

       O Generator NÃO inventa uma doença nova nem uma queixa
       arbitrária. Ele consulta as manifestações possíveis
       associadas à doença e instancia algumas delas.
       ========================================================= */

    generatePresentationCandidates(disease) {

        if (!disease) {
            return [];
        }

        const id =
            this.getDiseaseId(disease);

        const manifestations =
            this.engine.getPossibleManifestations(id) || [];

        const findings =
            this.engine.getPossibleFindings(id) || [];

        const candidates = [];


        /*
         * Manifestações clínicas vindas das relações do
         * Knowledge Base.
         */

        for (const item of manifestations) {

            if (!item) {
                continue;
            }

            if (item.entity) {

                candidates.push({

                    type: "manifestation",

                    source: item.entity,

                    relationship:
                        item.relationship || null
                });

            } else {

                candidates.push({

                    type: "manifestation",

                    source: item,

                    relationship:
                        item.relationship || null
                });
            }
        }


        /*
         * Findings estruturados.
         *
         * Só usamos findings como apresentação inicial quando não
         * conseguimos obter manifestações clínicas. Isso evita que
         * exames como troponina, ECG ou achados laboratoriais apareçam
         * indevidamente como "queixa" do paciente.
         */
        if (candidates.length === 0) {

            for (const finding of findings) {

                if (!finding) {
                    continue;
                }

                candidates.push({
                    type: "finding",
                    source: finding
                });
            }
        }


        /*
         * Remove duplicatas.
         */

        const unique = [];

        const seen = new Set();

        for (const item of candidates) {

            const reference =
                this.normalizeClinicalReference(item);

            if (!reference) {
                continue;
            }

            const key =
                reference.id ||
                reference.name;

            if (!key) {
                continue;
            }

            if (seen.has(key)) {
                continue;
            }

            seen.add(key);

            unique.push({

                ...item,

                reference
            });
        }


        return unique;
    }


    /* =========================================================
       NORMALIZAÇÃO DE REFERÊNCIA CLÍNICA
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


        /*
         * Caso a KB tenha apenas uma string.
         */

        if (typeof source === "string") {

            return {

                id: source,

                name: source,

                type:
                    item.type || null
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
            source.key ||
            null;

        const name =
            source.name ||
            source.label ||
            source.canonical_name ||
            source.term ||
            source.title ||
            source.description ||
            null;


        if (!id && !name) {
            return null;
        }


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


    isPresentableClinicalTerm(reference) {

        const text = String(
            reference?.name ||
            reference?.id ||
            ""
        ).toLowerCase();

        if (!text.trim()) return false;

        /*
         * Achados que pertencem à investigação/monitorização não devem
         * aparecer espontaneamente como queixa do paciente. Eles podem
         * continuar existindo no Patient State e ser revelados depois.
         */
        const nonPresentationPatterns = [
            "eletrocardi",
            "troponina",
            "marcador de lesao",
            "marcador de lesão",
            "laborator",
            "radiograf",
            "tomograf",
            "resson",
            "ecocardi",
            "ultrassom",
            "angio-tc",
            "angiotc",
            "alteracoes de st",
            "alterações de st",
            "onda t",
            "achado de imagem",
            "resultado de",
            "eventos coronarianos",
            "alteracoes eletrocardiograficas",
            "alterações eletrocardiográficas",
            "elevacao de",
            "elevação de",
            "congestao pulmonar",
            "congestão pulmonar",
            "instabilidade hemodinamica",
            "instabilidade hemodinâmica"
        ];

        return !nonPresentationPatterns.some(
            pattern => text.includes(pattern)
        );
    }


    /* =========================================================
       SINTOMAS DA APRESENTAÇÃO
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
                .map(item => {

                    return (
                        item.reference ||
                        this.normalizeClinicalReference(item)
                    );

                })
                .filter(Boolean)
                .filter(reference =>
                    this.isPresentableClinicalTerm(reference)
                );


        if (references.length === 0) {
            return [];
        }


        /*
         * Remove duplicatas.
         */

        const unique = [];

        const seen = new Set();

        for (const reference of references) {

            const key =
                reference.id ||
                reference.name;

            if (!key) {
                continue;
            }

            if (seen.has(key)) {
                continue;
            }

            seen.add(key);

            unique.push(reference);
        }


        if (unique.length === 0) {
            return [];
        }


        /*
         * Por padrão, a chegada possui entre 1 e 3
         * manifestações principais.
         *
         * Não colocamos 5 sintomas automaticamente.
         */

        let count;

        if (
            Number.isInteger(
                options.symptomCount
            )
        ) {

            count =
                Math.max(
                    1,
                    Math.min(
                        options.symptomCount,
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
       QUEIXA PRINCIPAL
       =========================================================
       A queixa é construída a partir dos sintomas selecionados
       pelo Generator.

       Não usamos o diagnóstico para escrever a queixa.
       ========================================================= */

    generateChiefComplaint(
        symptoms,
        options = {}
    ) {

        if (
            !Array.isArray(symptoms) ||
            symptoms.length === 0
        ) {

            return {

                symptoms: [],

                narrative:
                    options.narrative ||
                    null
            };
        }


        const symptomNames =
            symptoms
                .map(
                    symptom =>
                        symptom.name ||
                        symptom.id
                )
                .filter(Boolean);

        const displayNames =
            symptomNames.map(name =>
                this.humanizeSymptom(name)
            );

        let narrative =
            options.narrative ||
            null;

        if (!narrative && displayNames.length) {

            const primary = displayNames[0];
            const associated = displayNames.slice(1);
            const onset = options.onset?.description;

            narrative =
                `Chega ao serviço referindo ${primary}` +
                `${onset ? ` há ${String(onset).replace(/^há\s+/i, "")}` : ""}` +
                `${associated.length ? `, associada a ${this.joinNatural(associated)}` : ""}.`;
        }

        return {

            symptoms:
                symptoms.map(
                    symptom =>
                        symptom.id ||
                        symptom.name
                ),

            narrative,

            labels:
                displayNames
        };
    }


    humanizeSymptom(value) {

        const text = String(value || "").trim();
        const map = {
            "dor ou desconforto torácico": "dor no peito",
            "dor ou pressão torácica": "dor no peito",
            "dor torácica": "dor no peito",
            "dor toracica": "dor no peito",
            "dispneia": "falta de ar",
            "sudorese": "sudorese",
            "náuseas": "náuseas",
            "nauseas": "náuseas",
            "vômitos": "vômitos",
            "vomitos": "vômitos",
            "palpitação": "palpitações",
            "palpitacao": "palpitações",
            "síncope": "desmaio",
            "sincope": "desmaio",
            "edema periférico": "inchaço nas pernas",
            "edema": "inchaço"
        };

        return map[text.toLowerCase()] || text;
    }


    joinNatural(values) {

        if (!values.length) return "";
        if (values.length === 1) return values[0];
        if (values.length === 2) return `${values[0]} e ${values[1]}`;
        return `${values.slice(0, -1).join(", ")} e ${values[values.length - 1]}`;
    }


    /* =========================================================
       INÍCIO DOS SINTOMAS
       ========================================================= */

    generateOnset(
        disease,
        options = {}
    ) {

        if (options.onset) {
            return { ...options.onset };
        }

        /*
         * Para um caso de emergência, a apresentação inicial deve ser
         * temporalmente concreta. Não sorteamos "crônico" aleatoriamente
         * para uma chegada à Sala Vermelha.
         */
        let inferredType = null;

        const possiblePresentations =
            disease?.patient_generation?.possible_presentations;

        if (Array.isArray(possiblePresentations)) {
            const timingText = possiblePresentations
                .map(item => item?.timing || "")
                .join(" ")
                .toLowerCase();

            if (timingText.includes("crôn") || timingText.includes("cron")) {
                inferredType = "chronic";
            } else if (timingText.includes("agud") || timingText.includes("acute")) {
                inferredType = "acute";
            } else if (timingText.includes("subagud") || timingText.includes("subacute")) {
                inferredType = "subacute";
            }
        }

        if (!inferredType && Array.isArray(disease?.presentations)) {
            const presentationIds = disease.presentations
                .map(item => item?.id || "")
                .join(" ")
                .toLowerCase();

            if (presentationIds.includes("agud") || presentationIds.includes("acute")) {
                inferredType = "acute";
            }
        }

        const type =
            options.onsetType ||
            inferredType ||
            (options.mode === "emergency"
                ? "acute"
                : "subacute");

        let description =
            options.onsetDescription ||
            null;

        if (!description && type === "acute") {
            const minutes = this.randomInt(30, 180);
            if (minutes < 60) {
                description = `há aproximadamente ${minutes} minutos`;
            } else {
                const hours = Math.round(minutes / 60);
                description =
                    `há aproximadamente ${hours} hora${hours === 1 ? "" : "s"}`;
            }
        }

        if (!description && type === "subacute") {
            const days = this.randomInt(2, 7);
            description = `há aproximadamente ${days} dias`;
        }

        if (!description && type === "chronic") {
            description = "de evolução crônica";
        }

        return {
            type,
            description
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
                (options.mode === "emergency"
                    ? "chegada_ao_servico_de_emergencia"
                    : "procura_atendimento")
        };
    }


    /* =========================================================
       APRESENTAÇÃO COMPLETA
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


        /*
         * O sistema precisa saber se conseguiu construir
         * uma apresentação clínica real.
         */

        const onset =
            this.generateOnset(
                disease,
                options
            );


        const chiefComplaint =
            this.generateChiefComplaint(
                symptoms,
                {
                    ...options,
                    onset
                }
            );


        const context =
            this.generatePresentationContext(
                options
            );


        return {

            chief_complaint:
                chiefComplaint,

            onset,

            context,

            /*
             * Mantemos os candidatos disponíveis no estado
             * interno para facilitar debug e evolução do motor.
             */
            _candidates:
                candidates
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
            this.engine.getRiskFactors(id) || [];

        if (!Array.isArray(factors) || factors.length === 0) {
            return [];
        }


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
            this.engine.getEtiologies(id) || [];

        if (
            !Array.isArray(etiologies) ||
            etiologies.length === 0
        ) {
            return null;
        }

        return this.randomItem(
            etiologies
        );
    }


    /* =========================================================
       HISTÓRIA CLÍNICA
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
       INVESTIGAÇÕES POSSÍVEIS
       ========================================================= */

    generateInvestigationPossibilities(disease) {

        if (!disease) {
            return [];
        }

        const id =
            this.getDiseaseId(disease);

        return (
            this.engine
                .getPossibleInvestigations(id) || []
        );
    }


    /* =========================================================
       INVESTIGAÇÕES DO PACIENTE
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
                .getDifferentialEntities(id) || [];

        if (
            !Array.isArray(differentials) ||
            differentials.length === 0
        ) {
            return [];
        }

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

        return (
            this.engine
                .getPossibleTreatments(id) || []
        );
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
                .getPossibleComplications(id) || [];

        if (
            !Array.isArray(complications) ||
            complications.length === 0
        ) {
            return [];
        }

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
       =========================================================
       Todos os sinais vitais fazem parte do Patient State desde
       a criação do paciente e ficam disponíveis na interface.

       Valores explícitos recebidos em options.vitals têm prioridade.
       Quando não existem, é criado um perfil basal procedural.
       ========================================================= */

    generateVitals(severity, options = {}) {

        const source =
            options.vitals ||
            options.initialVitals ||
            {};

        const heartRate =
            source.heartRate ??
            source.heart_rate ??
            source.fc;

        const respiratoryRate =
            source.respiratoryRate ??
            source.respiratory_rate ??
            source.fr;

        const bloodPressure =
            source.bloodPressure ??
            source.blood_pressure ??
            source.pa;

        const oxygenSaturation =
            source.oxygenSaturation ??
            source.oxygen_saturation ??
            source.spo2 ??
            source.SpO2;

        const temperature =
            source.temperature ??
            source.temp;

        const glucose =
            source.glucose ??
            source.glicemia;

        let generatedHeartRate = this.randomInt(60, 99);
        let generatedRespiratoryRate = this.randomInt(12, 19);
        let generatedSystolic = this.randomInt(110, 129);
        let generatedDiastolic = this.randomInt(65, 84);
        let generatedSpo2 = this.randomInt(96, 100);
        let generatedTemperature =
            Number((36.0 + this.random() * 0.8).toFixed(1));
        let generatedGlucose = this.randomInt(70, 110);

        if (severity === "moderate") {
            generatedHeartRate = this.randomInt(80, 109);
            generatedRespiratoryRate = this.randomInt(16, 23);
            generatedSystolic = this.randomInt(105, 139);
            generatedDiastolic = this.randomInt(60, 89);
            generatedSpo2 = this.randomInt(94, 99);
            generatedTemperature =
                Number((36.0 + this.random() * 1.6).toFixed(1));
            generatedGlucose = this.randomInt(70, 140);
        }

        if (severity === "severe") {
            generatedHeartRate = this.randomInt(100, 139);
            generatedRespiratoryRate = this.randomInt(20, 31);
            generatedSystolic = this.randomInt(85, 119);
            generatedDiastolic = this.randomInt(50, 79);
            generatedSpo2 = this.randomInt(88, 96);
            generatedTemperature =
                Number((35.5 + this.random() * 2.5).toFixed(1));
            generatedGlucose = this.randomInt(70, 180);
        }

        return {

            stability:
                source.stability ??
                (
                    severity === "moderate"
                        ? this.randomInt(70, 89)
                        : severity === "severe"
                            ? this.randomInt(35, 69)
                            : 100
                ),

            heartRate:
                heartRate ?? generatedHeartRate,

            respiratoryRate:
                respiratoryRate ?? generatedRespiratoryRate,

            bloodPressure:
                bloodPressure ??
                `${generatedSystolic}/${generatedDiastolic}`,

            oxygenSaturation:
                oxygenSaturation ?? generatedSpo2,

            temperature:
                temperature ?? generatedTemperature,

            glucose:
                glucose ?? generatedGlucose
        };
    }


    /* =========================================================
       HIDDEN STATE
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
       ========================================================= */

    generatePatientState(
        disease,
        severity,
        demographics,
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

            demographics,

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
         * 4. APRESENTAÇÃO
         * -----------------------------------------------------
         */

        const presentation =
            this.generateClinicalPresentation(
                disease,
                options
            );


        /*
         * -----------------------------------------------------
         * PROTEÇÃO CONTRA PACIENTE SEM QUEIXA
         * -----------------------------------------------------
         *
         * Se a KB não possuir manifestações/finding utilizáveis,
         * não fabricamos uma queixa falsa.
         *
         * O erro é explicitado para que a KB seja corrigida.
         */

        if (
            !presentation
                .chief_complaint
                .symptoms
                .length
        ) {

            const diseaseName =
                this.getDiseaseName(
                    disease
                ) ||
                this.getDiseaseId(
                    disease
                ) ||
                "doença desconhecida";


            throw new Error(
                "PatientGenerator: a doença '" +
                diseaseName +
                "' não possui manifestações clínicas utilizáveis " +
                "para gerar a queixa inicial."
            );
        }


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
                severity,
                options
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
                demographics,
                presentation,
                history,
                vitals,
                physicalExam,
                investigations,
                options
            );


        /*
         * -----------------------------------------------------
         * 16. PACIENTE FINAL
         * -----------------------------------------------------
         */

        return {

            id:
                patientState.id,

            generatedAt:
                new Date().toISOString(),

            demographics,

            /*
             * Estado interno.
             *
             * A UI NÃO deve exibir condition diretamente.
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
             * Apresentação inicial do paciente.
             */

            presentation: {

                chief_complaint:
                    presentation.chief_complaint,

                onset:
                    presentation.onset,

                context:
                    presentation.context
            },

            history,

            physical_exam:
                physicalExam,

            investigations,

            differentials,

            treatments,

            complications,

            vitals,

            /*
             * Estado verdadeiro oculto.
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
