"use strict";

/**
 * ============================================================
 * DIAGNOSIS
 * INVESTIGATION ENGINE
 * ============================================================
 *
 * Responsabilidade:
 *
 * Receber uma investigação solicitada pelo médico e transformar
 * essa solicitação em uma investigação clínica coerente com o
 * Patient State e com a Knowledge Base.
 *
 * Fluxo:
 *
 * MÉDICO
 *   ↓
 * solicitação de investigação
 *   ↓
 * Investigation Engine
 *   ↓
 * identificação da investigação
 *   ↓
 * Patient State + Knowledge Base
 *   ↓
 * investigação realizada
 *   ↓
 * resultado determinado
 *   ↓
 * resultado registrado
 *   ↓
 * resultado revelado ao médico
 *
 * ============================================================
 *
 * PRINCÍPIO FUNDAMENTAL
 *
 * Este arquivo NÃO é uma enciclopédia médica.
 *
 * Ele não deve conter:
 *
 *     if (TEP) ...
 *     if (IAM) ...
 *     if (pneumonia) ...
 *
 * O conhecimento clínico pertence à Knowledge Base.
 *
 * O Investigation Engine fornece o mecanismo para:
 *
 *     solicitação
 *     identificação
 *     execução
 *     determinação do resultado
 *     registro
 *     revelação
 *
 * ============================================================
 *
 * COMPATIBILIDADE
 *
 * O engine foi projetado para trabalhar com:
 *
 * - PatientState
 * - Knowledge Base estruturada
 * - KnowledgeBaseLoader
 * - Clinical Interlocutor
 *
 * Também tolera diferentes formatos de definição de investigação
 * para facilitar a evolução das Knowledge Bases sem obrigar o
 * motor a ser reescrito.
 *
 * ============================================================
 */


/* ============================================================
 * UTILIDADES
 * ============================================================ */

function deepClone(value) {

    if (value === undefined || value === null) {
        return value;
    }

    if (typeof structuredClone === "function") {

        try {
            return structuredClone(value);
        } catch (error) {
            // Continua para o fallback.
        }
    }

    try {
        return JSON.parse(
            JSON.stringify(value)
        );
    } catch (error) {
        return value;
    }
}


function isObject(value) {

    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}


function ensureArray(value) {

    return Array.isArray(value)
        ? value
        : [];
}


function normalizeText(value) {

    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function createId(prefix = "investigation") {

    const timestamp =
        Date.now().toString(36);

    const random =
        Math.random()
            .toString(36)
            .slice(2, 10);

    return `${prefix}_${timestamp}_${random}`;
}


/* ============================================================
 * INVESTIGATION ENGINE
 * ============================================================ */

class InvestigationEngine {

    constructor(options = {}) {

        this.patientState =
            options.patientState || null;

        this.knowledgeBase =
            options.knowledgeBase || null;

        this.config = {

            /*
             * Percentual utilizado SOMENTE quando a própria
             * definição da investigação fornece uma faixa de
             * referência e o resultado foi explicitamente
             * determinado como normal.
             *
             * Isto é uma regra de geração do jogo, não uma
             * regra médica.
             */
            normalVariationFraction:
                Number.isFinite(
                    options.normalVariationFraction
                )
                    ? options.normalVariationFraction
                    : 0.05,

            /*
             * Por padrão, uma investigação já realizada não é
             * repetida automaticamente.
             */
            allowRepeat:
                options.allowRepeat === true,

            /*
             * Se true, uma investigação cuja definição existe,
             * mas que ainda não possui resultado estruturado,
             * poderá retornar um objeto de estado sem inventar
             * conteúdo clínico.
             */
            allowUnresolved:
                options.allowUnresolved !== false
        };

        this.history = [];

        this.lastResult = null;
    }


    /* ========================================================
     * CONFIGURAÇÃO
     * ======================================================== */

    setPatientState(
        patientState
    ) {

        this.patientState =
            patientState || null;

        return this;
    }


    setKnowledgeBase(
        knowledgeBase
    ) {

        this.knowledgeBase =
            knowledgeBase || null;

        return this;
    }


    /* ========================================================
     * EXTRAÇÃO DA KNOWLEDGE BASE
     * ======================================================== */

    getInvestigationDefinitions() {

        const kb = this.knowledgeBase;

        if (!kb) {
            return [];
        }

        /*
         * Formato principal.
         */
        if (
            Array.isArray(
                kb.investigations
            )
        ) {

            return kb.investigations;
        }

        /*
         * Algumas Knowledge Bases podem possuir
         * investigações dentro de domains ou módulos.
         */
        if (
            Array.isArray(kb.modules)
        ) {

            const results = [];

            for (const module of kb.modules) {

                if (
                    Array.isArray(
                        module?.investigations
                    )
                ) {

                    results.push(
                        ...module.investigations
                    );
                }
            }

            if (results.length) {
                return results;
            }
        }

        /*
         * Compatibilidade com modelos em que investigações
         * são entidades.
         */
        if (
            Array.isArray(kb.entities)
        ) {

            return kb.entities.filter(
                entity => {

                    const type =
                        normalizeText(
                            entity?.type
                        );

                    return (
                        type === "investigation" ||
                        type === "exam" ||
                        type === "examination" ||
                        type === "diagnostic test"
                    );
                }
            );
        }

        return [];
    }


    /* ========================================================
     * IDENTIFICAÇÃO
     * ======================================================== */

    extractInvestigationId(
        request
    ) {

        if (
            typeof request === "string"
        ) {

            return request.trim();
        }

        if (!isObject(request)) {
            return null;
        }

        return (
            request.id ||
            request.investigation_id ||
            request.investigationId ||
            request.test_id ||
            request.testId ||
            request.name ||
            request.exam ||
            request.test ||
            null
        );
    }


    getInvestigationName(
        definition
    ) {

        if (!definition) {
            return null;
        }

        return (
            definition.name ||
            definition.canonical_name ||
            definition.canonicalName ||
            definition.title ||
            definition.label ||
            definition.id ||
            null
        );
    }


    getInvestigationAliases(
        definition
    ) {

        if (!definition) {
            return [];
        }

        const aliases = [];

        const fields = [
            definition.aliases,
            definition.synonyms,
            definition.terms,
            definition.alternative_names,
            definition.alternativeNames
        ];

        for (const field of fields) {

            if (Array.isArray(field)) {

                aliases.push(
                    ...field
                );

            } else if (
                typeof field === "string"
            ) {

                aliases.push(field);
            }
        }

        const name =
            this.getInvestigationName(
                definition
            );

        if (name) {
            aliases.push(name);
        }

        if (definition.id) {
            aliases.push(
                definition.id
            );
        }

        return [
            ...new Set(
                aliases
                    .filter(Boolean)
                    .map(normalizeText)
                    .filter(Boolean)
            )
        ];
    }


    resolveInvestigation(
        request
    ) {

        const requestedId =
            this.extractInvestigationId(
                request
            );

        if (!requestedId) {
            return null;
        }

        const normalizedRequest =
            normalizeText(
                requestedId
            );

        const definitions =
            this.getInvestigationDefinitions();

        /*
         * Primeiro tenta correspondência exata
         * por ID.
         */
        for (const definition of definitions) {

            if (
                definition?.id &&
                normalizeText(
                    definition.id
                ) === normalizedRequest
            ) {

                return definition;
            }
        }

        /*
         * Depois tenta nome/canonical name/aliases.
         */
        for (const definition of definitions) {

            const aliases =
                this.getInvestigationAliases(
                    definition
                );

            if (
                aliases.includes(
                    normalizedRequest
                )
            ) {

                return definition;
            }
        }

        /*
         * Depois permite correspondência textual
         * controlada para facilitar linguagem natural.
         */
        for (const definition of definitions) {

            const aliases =
                this.getInvestigationAliases(
                    definition
                );

            const matched =
                aliases.some(
                    alias =>
                        alias.includes(
                            normalizedRequest
                        ) ||
                        normalizedRequest.includes(
                            alias
                        )
                );

            if (matched) {
                return definition;
            }
        }

        /*
         * Se o médico já forneceu um objeto estruturado,
         * podemos utilizá-lo como definição local.
         */
        if (
            isObject(request) &&
            (
                request.id ||
                request.name ||
                request.test ||
                request.exam
            )
        ) {

            return request;
        }

        return null;
    }


    /* ========================================================
     * VERIFICAÇÃO DO PATIENT STATE
     * ======================================================== */

    getStateObject() {

        if (!this.patientState) {
            return null;
        }

        /*
         * PatientState da arquitetura Diagnosis.
         */
        if (
            typeof this.patientState.get === "function"
        ) {

            return this.patientState.get();
        }

        /*
         * Compatibilidade com objeto simples.
         */
        if (
            isObject(this.patientState)
        ) {

            return this.patientState;
        }

        /*
         * Alguns objetos podem armazenar o estado em .state.
         */
        if (
            isObject(
                this.patientState.state
            )
        ) {

            return deepClone(
                this.patientState.state
            );
        }

        return null;
    }


    getCurrentTime() {

        if (
            this.patientState &&
            typeof this.patientState
                .getCurrentTime === "function"
        ) {

            return this.patientState
                .getCurrentTime();
        }

        const state =
            this.getStateObject();

        return (
            state?.evolution
                ?.current_time ??
            0
        );
    }


    /* ========================================================
     * HISTÓRICO DE INVESTIGAÇÕES
     * ======================================================== */

    hasAlreadyBeenPerformed(
        investigationId
    ) {

        if (!this.patientState) {
            return false;
        }

        if (
            typeof this.patientState
                .getInvestigations === "function"
        ) {

            const investigations =
                this.patientState
                    .getInvestigations();

            return Boolean(
                investigations
                    ?.performed
                    ?.includes(
                        investigationId
                    )
            );
        }

        const state =
            this.getStateObject();

        return Boolean(
            state
                ?.investigations
                ?.performed
                ?.includes(
                    investigationId
                )
        );
    }


    /* ========================================================
     * REGISTRO DA SOLICITAÇÃO
     * ======================================================== */

    registerRequest(
        investigationId
    ) {

        if (!this.patientState) {
            return false;
        }

        if (
            typeof this.patientState
                .requestInvestigation === "function"
        ) {

            this.patientState
                .requestInvestigation(
                    investigationId
                );

            return true;
        }

        const state =
            this.getStateObject();

        if (!state) {
            return false;
        }

        if (
            !isObject(
                state.investigations
            )
        ) {

            state.investigations = {};
        }

        if (
            !Array.isArray(
                state.investigations.requested
            )
        ) {

            state.investigations.requested =
                [];
        }

        if (
            !state.investigations
                .requested
                .includes(
                    investigationId
                )
        ) {

            state.investigations
                .requested
                .push(
                    investigationId
                );
        }

        return true;
    }


    /* ========================================================
     * DEFINIÇÃO DO RESULTADO
     * ======================================================== */

    /*
     * Procura uma definição de resultado estruturado.
     *
     * O engine aceita diferentes formatos para que as futuras
     * Knowledge Bases possam evoluir sem quebrar o motor.
     */

    getResultModel(
        definition
    ) {

        if (!definition) {
            return null;
        }

        const candidates = [

            definition.result_model,

            definition.resultModel,

            definition.result_definition,

            definition.resultDefinition,

            definition.results_model,

            definition.result_schema,

            definition.resultSchema
        ];

        for (const candidate of candidates) {

            if (
                isObject(candidate) ||
                Array.isArray(candidate)
            ) {

                return candidate;
            }
        }

        return null;
    }


    getPossibleResults(
        definition
    ) {

        if (!definition) {
            return [];
        }

        const candidates = [

            definition.possible_results,

            definition.possibleResults,

            definition.result_options,

            definition.resultOptions,

            definition.outcomes,

            definition.findings
        ];

        for (const candidate of candidates) {

            if (
                Array.isArray(candidate)
            ) {

                return candidate;
            }
        }

        return [];
    }


    /*
     * Procura uma definição de resultado normal.
     */
    getNormalDefinition(
        definition
    ) {

        if (!definition) {
            return null;
        }

        const resultModel =
            this.getResultModel(
                definition
            );

        if (resultModel) {

            if (
                resultModel.normal !== undefined
            ) {

                return resultModel.normal;
            }

            if (
                resultModel.normal_result !== undefined
            ) {

                return resultModel.normal_result;
            }

            if (
                resultModel.normalResult !== undefined
            ) {

                return resultModel.normalResult;
            }
        }

        const directCandidates = [

            definition.normal_result,

            definition.normalResult,

            definition.normal,

            definition.expected_normal
        ];

        for (
            const candidate
            of directCandidates
        ) {

            if (
                candidate !== undefined
            ) {

                return candidate;
            }
        }

        const possible =
            this.getPossibleResults(
                definition
            );

        for (const result of possible) {

            if (!isObject(result)) {
                continue;
            }

            if (
                result.normal === true ||
                result.category === "normal" ||
                normalizeText(
                    result.status
                ) === "normal"
            ) {

                return result;
            }
        }

        return null;
    }


    /* ========================================================
     * FAIXA DE REFERÊNCIA
     * ======================================================== */

    getReferenceRange(
        definition
    ) {

        if (!definition) {
            return null;
        }

        const candidates = [

            definition.reference_range,

            definition.referenceRange,

            definition.normal_range,

            definition.normalRange,

            definition.reference_values,

            definition.referenceValues
        ];

        for (
            const candidate
            of candidates
        ) {

            if (
                isObject(candidate) ||
                Array.isArray(candidate)
            ) {

                return deepClone(
                    candidate
                );
            }
        }

        const resultModel =
            this.getResultModel(
                definition
            );

        if (
            isObject(resultModel)
        ) {

            const nested = [

                resultModel.reference_range,

                resultModel.referenceRange,

                resultModel.normal_range,

                resultModel.normalRange
            ];

            for (
                const candidate
                of nested
            ) {

                if (
                    isObject(candidate) ||
                    Array.isArray(candidate)
                ) {

                    return deepClone(
                        candidate
                    );
                }
            }
        }

        return null;
    }


    /* ========================================================
     * GERAÇÃO DE RESULTADO NORMAL
     * ======================================================== */

    /*
     * IMPORTANTE:
     *
     * O engine só gera um valor numérico normal quando a
     * Knowledge Base fornece explicitamente uma faixa de
     * referência.
     *
     * Assim o motor não inventa limites clínicos.
     */

    generateValueInsideRange(
        minimum,
        maximum
    ) {

        const min =
            Number(minimum);

        const max =
            Number(maximum);

        if (
            !Number.isFinite(min) ||
            !Number.isFinite(max) ||
            min > max
        ) {

            return null;
        }

        const fraction =
            this.config
                .normalVariationFraction;

        /*
         * Mantém o valor próximo ao centro da faixa,
         * evitando sempre devolver o mesmo número.
         */
        const center =
            (min + max) / 2;

        const halfRange =
            (max - min) / 2;

        const variation =
            halfRange * fraction;

        let value =
            center +
            (
                (Math.random() * 2 - 1) *
                variation
            );

        value =
            Math.max(
                min,
                Math.min(
                    max,
                    value
                )
            );

        /*
         * Mantém uma representação razoável.
         */
        if (
            Number.isInteger(min) &&
            Number.isInteger(max)
        ) {

            return Math.round(
                value
            );
        }

        return Number(
            value.toFixed(2)
        );
    }


    normalizeRange(
        range
    ) {

        if (!range) {
            return null;
        }

        if (
            Array.isArray(range) &&
            range.length >= 2
        ) {

            const min =
                Number(range[0]);

            const max =
                Number(range[1]);

            if (
                Number.isFinite(min) &&
                Number.isFinite(max)
            ) {

                return {
                    min,
                    max,
                    unit: null
                };
            }
        }

        if (
            isObject(range)
        ) {

            const min =
                range.min ??
                range.minimum ??
                range.lower ??
                range.low;

            const max =
                range.max ??
                range.maximum ??
                range.upper ??
                range.high;

            if (
                Number.isFinite(
                    Number(min)
                ) &&
                Number.isFinite(
                    Number(max)
                )
            ) {

                return {

                    min:
                        Number(min),

                    max:
                        Number(max),

                    unit:
                        range.unit ??
                        null
                };
            }
        }

        return null;
    }


    buildNormalResult(
        definition
    ) {

        const normalDefinition =
            this.getNormalDefinition(
                definition
            );

        /*
         * Se a KB já fornece explicitamente o resultado normal,
         * usamos esse resultado.
         */
        if (
            normalDefinition !== null &&
            normalDefinition !== undefined
        ) {

            return deepClone(
                normalDefinition
            );
        }

        /*
         * Caso a definição tenha faixa de referência,
         * podemos produzir um valor dentro da própria faixa.
         */
        const reference =
            this.getReferenceRange(
                definition
            );

        const normalized =
            this.normalizeRange(
                reference
            );

        if (!normalized) {
            return null;
        }

        const value =
            this.generateValueInsideRange(
                normalized.min,
                normalized.max
            );

        if (value === null) {
            return null;
        }

        return {

            value,

            unit:
                normalized.unit,

            status:
                "normal",

            reference_range:
                deepClone(
                    reference
                )
        };
    }


    /* ========================================================
     * RESOLUÇÃO DE RESULTADO
     * ======================================================== */

    choosePossibleResult(
        possibleResults
    ) {

        if (
            !Array.isArray(
                possibleResults
            ) ||
            possibleResults.length === 0
        ) {

            return null;
        }

        /*
         * Resultados podem possuir peso.
         */
        const weighted =
            possibleResults.filter(
                item =>
                    isObject(item) &&
                    Number.isFinite(
                        Number(
                            item.weight ??
                            item.probability
                        )
                    )
            );

        if (
            weighted.length ===
            possibleResults.length
        ) {

            const total =
                weighted.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Math.max(
                            0,
                            Number(
                                item.weight ??
                                item.probability
                            )
                        ),
                    0
                );

            if (total > 0) {

                let random =
                    Math.random() *
                    total;

                for (
                    const item
                    of weighted
                ) {

                    random -=
                        Math.max(
                            0,
                            Number(
                                item.weight ??
                                item.probability
                            )
                        );

                    if (random <= 0) {

                        return deepClone(
                            item
                        );
                    }
                }
            }
        }

        /*
         * Sem peso explícito, seleção uniforme.
         */
        const index =
            Math.floor(
                Math.random() *
                possibleResults.length
            );

        return deepClone(
            possibleResults[index]
        );
    }


    /*
     * Procura resultado específico no Patient State.
     *
     * Isso é importante para o princípio:
     *
     * "O resultado pertence ao paciente."
     *
     * Se a geração do caso já tiver determinado o resultado,
     * o Investigation Engine deve utilizá-lo em vez de criar
     * outro resultado.
     */

    getPreexistingResult(
        investigationId,
        definition
    ) {

        const state =
            this.getStateObject();

        const results =
            state
                ?.investigations
                ?.results;

        if (!results) {
            return null;
        }

        const keys = [

            investigationId,

            definition?.id,

            definition?.name,

            definition?.canonical_name,

            definition?.canonicalName
        ]
            .filter(Boolean);

        for (const key of keys) {

            if (
                Object.prototype
                    .hasOwnProperty
                    .call(
                        results,
                        key
                    )
            ) {

                return deepClone(
                    results[key]
                );
            }
        }

        return null;
    }


    resolveResult(
        definition,
        investigationId
    ) {

        /*
         * 1. Resultado previamente determinado para
         * aquele paciente.
         */
        const preexisting =
            this.getPreexistingResult(
                investigationId,
                definition
            );

        if (preexisting !== null) {

            return {

                status:
                    "resolved",

                source:
                    "patient_state",

                result:
                    preexisting
            };
        }


        /*
         * 2. Um resultado normal explicitamente definido.
         */
        const normal =
            this.buildNormalResult(
                definition
            );

        if (normal !== null) {

            return {

                status:
                    "resolved",

                source:
                    "knowledge_base_normal",

                result:
                    normal
            };
        }


        /*
         * 3. Possíveis resultados fornecidos pela KB.
         */
        const possible =
            this.choosePossibleResult(
                this.getPossibleResults(
                    definition
                )
            );

        if (possible !== null) {

            return {

                status:
                    "resolved",

                source:
                    "knowledge_base_possible_result",

                result:
                    possible
            };
        }


        /*
         * 4. Modelo de resultado estruturado que não
         * possui campo normal explícito.
         */
        const resultModel =
            this.getResultModel(
                definition
            );

        if (
            resultModel !== null &&
            !Array.isArray(resultModel)
        ) {

            /*
             * Não transforma o modelo inteiro em um resultado
             * clínico arbitrariamente. Apenas utiliza campos
             * explicitamente marcados como default.
             */
            const defaults = [

                resultModel.default,

                resultModel.default_result,

                resultModel.defaultResult
            ];

            for (
                const candidate
                of defaults
            ) {

                if (
                    candidate !== undefined
                ) {

                    return {

                        status:
                            "resolved",

                        source:
                            "knowledge_base_default",

                        result:
                            deepClone(
                                candidate
                            )
                    };
                }
            }
        }


        /*
         * 5. Nenhum resultado estruturado.
         *
         * Não inventar medicina.
         */
        if (
            this.config.allowUnresolved
        ) {

            return {

                status:
                    "unresolved",

                source:
                    "knowledge_base_missing",

                result:
                    null
            };
        }

        return {

            status:
                "error",

            source:
                "none",

            result:
                null
        };
    }


    /* ========================================================
     * REGISTRO DO RESULTADO NO PATIENT STATE
     * ======================================================== */

    persistResult(
        investigationId,
        result
    ) {

        if (!this.patientState) {
            return false;
        }

        /*
         * API oficial do PatientState.
         */
        if (
            typeof this.patientState
                .setInvestigationResult === "function"
        ) {

            this.patientState
                .setInvestigationResult(
                    investigationId,
                    result
                );

            return true;
        }

        /*
         * Fallback para estado simples.
         */
        const state =
            this.getStateObject();

        if (!state) {
            return false;
        }

        if (
            !isObject(
                state.investigations
            )
        ) {

            state.investigations = {};
        }

        if (
            !isObject(
                state.investigations.results
            )
        ) {

            state.investigations.results =
                {};
        }

        state.investigations
            .results[
                investigationId
            ] =
            deepClone(
                result
            );

        if (
            !Array.isArray(
                state.investigations.performed
            )
        ) {

            state.investigations.performed =
                [];
        }

        if (
            !state.investigations
                .performed
                .includes(
                    investigationId
                )
        ) {

            state.investigations
                .performed
                .push(
                    investigationId
                );
        }

        return true;
    }


    /* ========================================================
     * REVELAÇÃO
     * ======================================================== */

    revealResult(
        investigationId
    ) {

        if (!this.patientState) {
            return false;
        }

        /*
         * A investigação realizada passa a ser conhecida
         * pelo médico.
         */
        if (
            typeof this.patientState
                .reveal === "function"
        ) {

            /*
             * Se a investigação estiver explicitamente
             * em revealable, utiliza o mecanismo oficial.
             */
            if (
                typeof this.patientState
                    .canReveal === "function" &&
                this.patientState
                    .canReveal(
                        "investigations",
                        investigationId
                    )
            ) {

                this.patientState
                    .reveal(
                        "investigations",
                        investigationId
                    );

                return true;
            }
        }

        /*
         * A persistência do resultado já representa que o
         * exame foi realizado.
         *
         * A revelação completa poderá ser refinada pelo
         * Clinical Interlocutor posteriormente.
         */
        return true;
    }


    /* ========================================================
     * EXECUÇÃO
     * ======================================================== */

    async execute(
        request,
        options = {}
    ) {

        const startedAt =
            Date.now();

        const investigationId =
            this.extractInvestigationId(
                request
            );

        if (!investigationId) {

            return this.createErrorResult(
                request,
                "Não foi possível identificar a investigação solicitada."
            );
        }

        const definition =
            this.resolveInvestigation(
                request
            );

        if (!definition) {

            /*
             * Não devemos inventar uma investigação que
             * não exista no conhecimento disponível.
             */
            return this.createErrorResult(
                request,
                `Investigação não encontrada na Knowledge Base: ${investigationId}`
            );
        }

        const canonicalId =
            definition.id ||
            investigationId;

        /*
         * Verifica repetição.
         */
        if (
            !this.config.allowRepeat &&
            this.hasAlreadyBeenPerformed(
                canonicalId
            )
        ) {

            const previous =
                this.getPreexistingResult(
                    canonicalId,
                    definition
                );

            const repeatedResult = {

                success:
                    true,

                status:
                    "already_performed",

                investigation_id:
                    canonicalId,

                investigation_name:
                    this.getInvestigationName(
                        definition
                    ),

                result:
                    previous,

                source:
                    "patient_state",

                elapsed_ms:
                    Date.now() -
                    startedAt
            };

            this.history.push(
                deepClone(
                    repeatedResult
                )
            );

            this.lastResult =
                repeatedResult;

            return repeatedResult;
        }


        /*
         * Registra a solicitação.
         */
        this.registerRequest(
            canonicalId
        );


        /*
         * Resolve o resultado.
         */
        const resolution =
            this.resolveResult(
                definition,
                canonicalId
            );


        /*
         * Caso não exista resultado estruturado,
         * não inventamos.
         */
        if (
            resolution.status ===
            "unresolved"
        ) {

            const unresolved = {

                success:
                    false,

                status:
                    "unresolved",

                investigation_id:
                    canonicalId,

                investigation_name:
                    this.getInvestigationName(
                        definition
                    ),

                result:
                    null,

                source:
                    resolution.source,

                message:
                    "A investigação foi reconhecida e solicitada, mas a Knowledge Base ainda não possui um modelo estruturado de resultado para este exame.",

                elapsed_ms:
                    Date.now() -
                    startedAt
            };

            this.history.push(
                deepClone(
                    unresolved
                )
            );

            this.lastResult =
                unresolved;

            return unresolved;
        }


        /*
         * Resultado determinado.
         */
        this.persistResult(
            canonicalId,
            resolution.result
        );

        this.revealResult(
            canonicalId
        );


        /*
         * Registro final.
         */
        const output = {

            success:
                true,

            status:
                "completed",

            investigation_id:
                canonicalId,

            investigation_name:
                this.getInvestigationName(
                    definition
                ),

            result:
                deepClone(
                    resolution.result
                ),

            source:
                resolution.source,

            time:
                this.getCurrentTime(),

            elapsed_ms:
                Date.now() -
                startedAt
        };


        /*
         * Permite ao chamador adicionar metadados sem
         * alterar o núcleo do resultado.
         */
        if (
            isObject(
                options.metadata
            )
        ) {

            output.metadata =
                deepClone(
                    options.metadata
                );
        }


        this.history.push(
            deepClone(
                output
            )
        );

        this.lastResult =
            output;

        return output;
    }


    /* ========================================================
     * VERSÃO SÍNCRONA
     *
     * Útil para o engine atual, que trabalha localmente.
     * ======================================================== */

    executeSync(
        request,
        options = {}
    ) {

        /*
         * A implementação principal é síncrona em sua lógica.
         * Este método evita obrigar o engine atual a utilizar
         * Promise quando não houver necessidade.
         */

        const startedAt =
            Date.now();

        const investigationId =
            this.extractInvestigationId(
                request
            );

        if (!investigationId) {

            return this.createErrorResult(
                request,
                "Não foi possível identificar a investigação solicitada."
            );
        }

        const definition =
            this.resolveInvestigation(
                request
            );

        if (!definition) {

            return this.createErrorResult(
                request,
                `Investigação não encontrada na Knowledge Base: ${investigationId}`
            );
        }

        const canonicalId =
            definition.id ||
            investigationId;


        if (
            !this.config.allowRepeat &&
            this.hasAlreadyBeenPerformed(
                canonicalId
            )
        ) {

            const previous =
                this.getPreexistingResult(
                    canonicalId,
                    definition
                );

            const repeatedResult = {

                success:
                    true,

                status:
                    "already_performed",

                investigation_id:
                    canonicalId,

                investigation_name:
                    this.getInvestigationName(
                        definition
                    ),

                result:
                    previous,

                source:
                    "patient_state",

                elapsed_ms:
                    Date.now() -
                    startedAt
            };

            this.history.push(
                deepClone(
                    repeatedResult
                )
            );

            this.lastResult =
                repeatedResult;

            return repeatedResult;
        }


        this.registerRequest(
            canonicalId
        );


        const resolution =
            this.resolveResult(
                definition,
                canonicalId
            );


        if (
            resolution.status ===
            "unresolved"
        ) {

            const unresolved = {

                success:
                    false,

                status:
                    "unresolved",

                investigation_id:
                    canonicalId,

                investigation_name:
                    this.getInvestigationName(
                        definition
                    ),

                result:
                    null,

                source:
                    resolution.source,

                message:
                    "A investigação foi reconhecida e solicitada, mas a Knowledge Base ainda não possui um modelo estruturado de resultado para este exame.",

                elapsed_ms:
                    Date.now() -
                    startedAt
            };

            this.history.push(
                deepClone(
                    unresolved
                )
            );

            this.lastResult =
                unresolved;

            return unresolved;
        }


        this.persistResult(
            canonicalId,
            resolution.result
        );

        this.revealResult(
            canonicalId
        );


        const output = {

            success:
                true,

            status:
                "completed",

            investigation_id:
                canonicalId,

            investigation_name:
                this.getInvestigationName(
                    definition
                ),

            result:
                deepClone(
                    resolution.result
                ),

            source:
                resolution.source,

            time:
                this.getCurrentTime(),

            elapsed_ms:
                Date.now() -
                startedAt
        };


        if (
            isObject(
                options.metadata
            )
        ) {

            output.metadata =
                deepClone(
                    options.metadata
                );
        }


        this.history.push(
            deepClone(
                output
            )
        );

        this.lastResult =
            output;

        return output;
    }


    /* ========================================================
     * ERRO
     * ======================================================== */

    createErrorResult(
        request,
        message
    ) {

        const result = {

            success:
                false,

            status:
                "error",

            investigation_id:
                this.extractInvestigationId(
                    request
                ),

            investigation_name:
                null,

            result:
                null,

            source:
                "none",

            message:
                message
        };

        this.history.push(
            deepClone(
                result
            )
        );

        this.lastResult =
            result;

        return result;
    }


    /* ========================================================
     * ACESSO AO HISTÓRICO
     * ======================================================== */

    getHistory() {

        return deepClone(
            this.history
        );
    }


    getLastResult() {

        return deepClone(
            this.lastResult
        );
    }


    clearHistory() {

        this.history = [];

        this.lastResult =
            null;

        return true;
    }


    /* ========================================================
     * RESUMO
     * ======================================================== */

    summary() {

        return {

            investigations_available:
                this.getInvestigationDefinitions()
                    .length,

            investigations_executed:
                this.history
                    .filter(
                        item =>
                            item.status ===
                            "completed"
                    )
                    .length,

            last_result:
                this.getLastResult()
        };
    }
}


/* ============================================================
 * EXPORTAÇÃO
 * ============================================================ */

if (
    typeof window !== "undefined"
) {

    window.InvestigationEngine =
        InvestigationEngine;
}


if (
    typeof module !== "undefined" &&
    module.exports
) {

    module.exports =
        InvestigationEngine;
}


/* ============================================================
 * FIM
 * ============================================================ */
