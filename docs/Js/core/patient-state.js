"use strict";

/**
 * ============================================================
 * DIAGNOSIS
 * PATIENT STATE
 * ============================================================
 *
 * Responsabilidade:
 * - representar um paciente específico durante a simulação;
 * - manter o estado clínico atual;
 * - separar verdade interna de informação revelável;
 * - controlar informações já reveladas;
 * - registrar investigações;
 * - registrar intervenções;
 * - registrar evolução temporal;
 * - fornecer snapshots antes/depois de ações.
 *
 * NÃO É RESPONSABILIDADE DESTE ARQUIVO:
 * - gerar doenças;
 * - inventar conhecimento médico;
 * - interpretar linguagem natural;
 * - diagnosticar o paciente;
 * - determinar condutas médicas;
 * - pontuar o jogador.
 *
 * Esses papéis pertencem a outros componentes.
 *
 * ARQUITETURA:
 *
 * Knowledge Base
 *       ↓
 * Case Generator
 *       ↓
 * Patient State
 *       ↓
 * ┌───────────────┬────────────────┬─────────────────┐
 * ↓               ↓                ↓
 * Interlocutor  Investigation   Intervention
 *                                    ↓
 *                               Patient State
 *                                    ↓
 *                                Evolution
 *                                    ↓
 *                                Evaluation
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
            // Fallback abaixo.
        }
    }

    return JSON.parse(JSON.stringify(value));
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


function ensureObject(value) {

    return isObject(value)
        ? value
        : {};
}


function createId(prefix = "id") {

    const random =
        Math.random()
            .toString(36)
            .slice(2, 10);

    const timestamp =
        Date.now()
            .toString(36);

    return `${prefix}_${timestamp}_${random}`;
}


/* ============================================================
 * PATIENT STATE
 * ============================================================ */

class PatientState {

    constructor(initialState = {}) {

        const state =
            isObject(initialState)
                ? deepClone(initialState)
                : {};

        this.state =
            this.normalizeState(state);

        this.validate();
    }


    /* ========================================================
     * ESTADO INICIAL
     * ======================================================== */

    normalizeState(state) {

        const normalized = {

            id:
                state.id ||
                createId("patient"),

            identity: {

                name:
                    state.identity?.name ??
                    state.demographics?.name ??
                    null,

                social_name:
                    state.identity?.social_name ??
                    null
            },


            demographics: {

                age:
                    state.demographics?.age ??
                    null,

                sex:
                    state.demographics?.sex ??
                    null,

                birth_date:
                    state.demographics?.birth_date ??
                    null
            },


            epidemiology: {

                origin:
                    state.epidemiology?.origin ??
                    null,

                residence:
                    state.epidemiology?.residence ??
                    null,

                occupation:
                    state.epidemiology?.occupation ??
                    null,

                exposures:
                    ensureArray(
                        state.epidemiology?.exposures
                    ),

                epidemiological_context:
                    ensureArray(
                        state.epidemiology?.epidemiological_context
                    )
            },


            presentation: {

                chief_complaint: {

                    primary:
                        state.presentation
                            ?.chief_complaint
                            ?.primary ??
                        state.presentation
                            ?.chief_complaint
                            ?.narrative ??
                        null,

                    symptoms:
                        ensureArray(
                            state.presentation
                                ?.chief_complaint
                                ?.symptoms
                        ),

                    narrative:
                        state.presentation
                            ?.chief_complaint
                            ?.narrative ??
                        null
                },


                associated_complaints:
                    ensureArray(
                        state.presentation
                            ?.associated_complaints
                    ),


                onset: {

                    type:
                        state.presentation
                            ?.onset
                            ?.type ??
                        null,

                    description:
                        state.presentation
                            ?.onset
                            ?.description ??
                        null
                },


                context: {

                    arrival_mode:
                        state.presentation
                            ?.context
                            ?.arrival_mode ??
                        null,

                    accompanied:
                        state.presentation
                            ?.context
                            ?.accompanied ??
                        null,

                    brought_exam:
                        Boolean(
                            state.presentation
                                ?.context
                                ?.brought_exam
                        ),

                    arrival_information:
                        state.presentation
                            ?.context
                            ?.arrival_information ??
                        null
                }
            },


            history: {

                past_medical_history:
                    ensureArray(
                        state.history
                            ?.past_medical_history
                    ),

                medications:
                    ensureArray(
                        state.history
                            ?.medications
                    ),

                allergies:
                    ensureArray(
                        state.history
                            ?.allergies
                    ),

                family_history:
                    ensureArray(
                        state.history
                            ?.family_history
                    ),

                social_history:
                    ensureArray(
                        state.history
                            ?.social_history
                    ),

                disease_history:
                    ensureObject(
                        state.history
                            ?.disease_history
                    )
            },


            vitals: {

                heart_rate:
                    state.vitals
                        ?.heart_rate ??
                    null,

                respiratory_rate:
                    state.vitals
                        ?.respiratory_rate ??
                    null,

                blood_pressure: {

                    systolic:
                        state.vitals
                            ?.blood_pressure
                            ?.systolic ??
                        null,

                    diastolic:
                        state.vitals
                            ?.blood_pressure
                            ?.diastolic ??
                        null
                },

                oxygen_saturation:
                    state.vitals
                        ?.oxygen_saturation ??
                    null,

                temperature:
                    state.vitals
                        ?.temperature ??
                    null,

                glucose:
                    state.vitals
                        ?.glucose ??
                    null,

                other:
                    ensureObject(
                        state.vitals?.other
                    )
            },


            physical_exam: {

                general:
                    ensureObject(
                        state.physical_exam
                            ?.general
                    ),

                cardiovascular:
                    ensureObject(
                        state.physical_exam
                            ?.cardiovascular
                    ),

                respiratory:
                    ensureObject(
                        state.physical_exam
                            ?.respiratory
                    ),

                neurologic:
                    ensureObject(
                        state.physical_exam
                            ?.neurologic
                    ),

                abdomen:
                    ensureObject(
                        state.physical_exam
                            ?.abdomen
                    ),

                extremities:
                    ensureObject(
                        state.physical_exam
                            ?.extremities
                    ),

                skin:
                    ensureObject(
                        state.physical_exam
                            ?.skin
                    ),

                other:
                    ensureObject(
                        state.physical_exam
                            ?.other
                    )
            },


            investigations: {

                requested:
                    ensureArray(
                        state.investigations
                            ?.requested
                    ),

                performed:
                    ensureArray(
                        state.investigations
                            ?.performed
                    ),

                results:
                    ensureObject(
                        state.investigations
                            ?.results
                    ),

                pending:
                    ensureArray(
                        state.investigations
                            ?.pending
                    )
            },


            /* ==================================================
             * VERDADE INTERNA
             * ================================================== */

            internal_truth: {

                diagnosis:
                    state.internal_truth
                        ?.diagnosis ??
                    null,

                differential:
                    ensureArray(
                        state.internal_truth
                            ?.differential
                    ),

                pathophysiology:
                    ensureObject(
                        state.internal_truth
                            ?.pathophysiology
                    ),

                physiological_state:
                    ensureObject(
                        state.internal_truth
                            ?.physiological_state
                    ),

                severity:
                    state.internal_truth
                        ?.severity ??
                    null,

                complications:
                    ensureArray(
                        state.internal_truth
                            ?.complications
                    ),

                evolution_model:
                    ensureObject(
                        state.internal_truth
                            ?.evolution_model
                    )
            },


            /* ==================================================
             * INFORMAÇÕES QUE PODEM SER DESCOBERTAS
             * ================================================== */

            revealable: {

                history:
                    ensureArray(
                        state.revealable
                            ?.history
                    ),

                physical_exam:
                    ensureArray(
                        state.revealable
                            ?.physical_exam
                    ),

                vitals:
                    ensureArray(
                        state.revealable
                            ?.vitals
                    ),

                investigations:
                    ensureArray(
                        state.revealable
                            ?.investigations
                    ),

                other:
                    ensureArray(
                        state.revealable
                            ?.other
                    )
            },


            /* ==================================================
             * INFORMAÇÕES JÁ DESCOBERTAS
             * ================================================== */

            revealed: {

                history:
                    ensureArray(
                        state.revealed
                            ?.history
                    ),

                physical_exam:
                    ensureArray(
                        state.revealed
                            ?.physical_exam
                    ),

                vitals:
                    ensureArray(
                        state.revealed
                            ?.vitals
                    ),

                investigations:
                    ensureArray(
                        state.revealed
                            ?.investigations
                    ),

                other:
                    ensureArray(
                        state.revealed
                            ?.other
                    )
            },


            /* ==================================================
             * INTERVENÇÕES
             * ================================================== */

            interventions:
                ensureArray(
                    state.interventions
                ),


            /* ==================================================
             * EVOLUÇÃO
             * ================================================== */

            evolution: {

                current_time:
                    Number.isFinite(
                        state.evolution
                            ?.current_time
                    )
                        ? state.evolution.current_time
                        : 0,

                events:
                    ensureArray(
                        state.evolution
                            ?.events
                    ),

                current_state:
                    ensureObject(
                        state.evolution
                            ?.current_state
                    ),

                trajectory:
                    ensureArray(
                        state.evolution
                            ?.trajectory
                    )
            },


            /* ==================================================
             * METADATA
             * ================================================== */

            metadata: {

                case_id:
                    state.metadata
                        ?.case_id ??
                    null,

                knowledge_base_id:
                    state.metadata
                        ?.knowledge_base_id ??
                    null,

                created_at:
                    state.metadata
                        ?.created_at ??
                    new Date().toISOString(),

                status:
                    state.metadata
                        ?.status ??
                    "active"
            }
        };


        return normalized;
    }


    /* ============================================================
     * VALIDAÇÃO
     * ============================================================ */

    validate() {

        const errors = [];

        if (!this.state.id) {
            errors.push(
                "Patient State sem ID."
            );
        }

        if (
            !this.state.presentation ||
            !this.state.presentation.chief_complaint
        ) {
            errors.push(
                "Apresentação clínica ausente."
            );
        }

        if (!this.state.internal_truth) {
            errors.push(
                "Internal Truth ausente."
            );
        }

        if (!this.state.revealable) {
            errors.push(
                "Revealable ausente."
            );
        }

        if (!this.state.revealed) {
            errors.push(
                "Revealed ausente."
            );
        }

        this.validationErrors = errors;

        return {
            valid: errors.length === 0,
            errors
        };
    }


    isValid() {

        return this.validationErrors.length === 0;
    }


    /* ============================================================
     * ACESSO AO ESTADO
     * ============================================================ */

    get(path = null) {

        if (!path) {
            return deepClone(this.state);
        }

        const parts =
            String(path)
                .split(".")
                .filter(Boolean);

        let current = this.state;

        for (const part of parts) {

            if (
                current === null ||
                current === undefined
            ) {
                return undefined;
            }

            current = current[part];
        }

        return deepClone(current);
    }


    set(path, value) {

        const parts =
            String(path)
                .split(".")
                .filter(Boolean);

        if (!parts.length) {
            return false;
        }

        let current = this.state;

        for (
            let index = 0;
            index < parts.length - 1;
            index++
        ) {

            const key = parts[index];

            if (
                !isObject(current[key]) &&
                !Array.isArray(current[key])
            ) {
                current[key] = {};
            }

            current = current[key];
        }

        current[
            parts[parts.length - 1]
        ] = deepClone(value);

        return true;
    }


    /* ============================================================
     * IDENTIFICAÇÃO
     * ============================================================ */

    getId() {

        return this.state.id;
    }


    getCaseId() {

        return this.state.metadata.case_id;
    }


    getKnowledgeBaseId() {

        return this.state.metadata
            .knowledge_base_id;
    }


    /* ============================================================
     * APRESENTAÇÃO
     * ============================================================ */

    getPresentation() {

        return deepClone(
            this.state.presentation
        );
    }


    getChiefComplaint() {

        return deepClone(
            this.state.presentation
                .chief_complaint
        );
    }


    getSymptoms() {

        return [
            ...this.state.presentation
                .chief_complaint
                .symptoms
        ];
    }


    getAssociatedComplaints() {

        return [
            ...this.state.presentation
                .associated_complaints
        ];
    }


    /* ============================================================
     * HISTÓRIA
     * ============================================================ */

    getHistory() {

        return deepClone(
            this.state.history
        );
    }


    addHistoryItem(
        category,
        item
    ) {

        const allowed = [
            "past_medical_history",
            "medications",
            "allergies",
            "family_history",
            "social_history"
        ];

        if (!allowed.includes(category)) {
            return false;
        }

        this.state.history[category]
            .push(deepClone(item));

        return true;
    }


    /* ============================================================
     * SINAIS VITAIS
     * ============================================================ */

    getVitals() {

        return deepClone(
            this.state.vitals
        );
    }


    setVital(
        name,
        value
    ) {

        const allowed = [
            "heart_rate",
            "respiratory_rate",
            "oxygen_saturation",
            "temperature",
            "glucose"
        ];

        if (allowed.includes(name)) {

            this.state.vitals[name] =
                value;

            return true;
        }

        if (
            name === "systolic" ||
            name === "diastolic"
        ) {

            this.state.vitals
                .blood_pressure[name] =
                value;

            return true;
        }

        return false;
    }


    setBloodPressure(
        systolic,
        diastolic
    ) {

        this.state.vitals
            .blood_pressure = {

                systolic:
                    systolic ?? null,

                diastolic:
                    diastolic ?? null
            };

        return true;
    }


    /* ============================================================
     * EXAME FÍSICO
     * ============================================================ */

    getPhysicalExam() {

        return deepClone(
            this.state.physical_exam
        );
    }


    setPhysicalFinding(
        system,
        finding,
        value
    ) {

        if (
            !isObject(
                this.state.physical_exam[system]
            )
        ) {
            this.state.physical_exam[system] =
                {};
        }

        this.state.physical_exam[system][finding] =
            deepClone(value);

        return true;
    }


    /* ============================================================
     * INVESTIGAÇÕES
     * ============================================================ */

    requestInvestigation(
        investigation
    ) {

        if (!investigation) {
            return null;
        }

        const id =
            typeof investigation === "string"
                ? investigation
                : investigation.id ||
                  investigation.name ||
                  createId("investigation");

        if (
            !this.state.investigations
                .requested
                .includes(id)
        ) {

            this.state.investigations
                .requested
                .push(id);
        }

        return id;
    }


    markInvestigationPerformed(
        investigation
    ) {

        if (!investigation) {
            return false;
        }

        const id =
            typeof investigation === "string"
                ? investigation
                : investigation.id ||
                  investigation.name;

        if (!id) {
            return false;
        }

        if (
            !this.state.investigations
                .performed
                .includes(id)
        ) {

            this.state.investigations
                .performed
                .push(id);
        }

        this.state.investigations
            .pending =
            this.state.investigations
                .pending
                .filter(
                    item => item !== id
                );

        return true;
    }


    setInvestigationResult(
        investigation,
        result
    ) {

        if (!investigation) {
            return false;
        }

        const id =
            typeof investigation === "string"
                ? investigation
                : investigation.id ||
                  investigation.name;

        if (!id) {
            return false;
        }

        this.state.investigations
            .results[id] =
            deepClone(result);

        this.markInvestigationPerformed(id);

        return true;
    }


    getInvestigationResult(
        investigation
    ) {

        if (!investigation) {
            return undefined;
        }

        return deepClone(
            this.state.investigations
                .results[investigation]
        );
    }


    getInvestigations() {

        return deepClone(
            this.state.investigations
        );
    }


    /* ============================================================
     * REVELAÇÃO DE INFORMAÇÕES
     * ============================================================ */

    isRevealed(
        category,
        key
    ) {

        const list =
            this.state.revealed[category];

        if (!Array.isArray(list)) {
            return false;
        }

        return list.includes(key);
    }


    canReveal(
        category,
        key
    ) {

        const revealable =
            this.state.revealable[category];

        if (!Array.isArray(revealable)) {
            return false;
        }

        return revealable.includes(key);
    }


    reveal(
        category,
        key
    ) {

        if (
            !Object.prototype.hasOwnProperty
                .call(
                    this.state.revealable,
                    category
                )
        ) {
            return false;
        }

        if (
            !this.canReveal(
                category,
                key
            )
        ) {
            return false;
        }

        if (
            !Array.isArray(
                this.state.revealed[category]
            )
        ) {
            this.state.revealed[category] =
                [];
        }

        if (
            !this.state.revealed[category]
                .includes(key)
        ) {

            this.state.revealed[category]
                .push(key);
        }

        return true;
    }


    revealMultiple(
        category,
        keys
    ) {

        if (!Array.isArray(keys)) {
            return 0;
        }

        let revealed = 0;

        for (const key of keys) {

            if (
                this.reveal(
                    category,
                    key
                )
            ) {
                revealed++;
            }
        }

        return revealed;
    }


    getRevealed() {

        return deepClone(
            this.state.revealed
        );
    }


    getRevealable() {

        return deepClone(
            this.state.revealable
        );
    }


    /* ============================================================
     * INTERNAL TRUTH
     *
     * IMPORTANTE:
     * Estes métodos existem para os motores internos.
     * A UI NÃO deve chamar getInternalTruth()
     * para montar a apresentação do paciente.
     * ============================================================ */

    getInternalTruth() {

        return deepClone(
            this.state.internal_truth
        );
    }


    getDiagnosis() {

        return this.state.internal_truth
            .diagnosis;
    }


    getPhysiologicalState() {

        return deepClone(
            this.state.internal_truth
                .physiological_state
        );
    }


    setPhysiologicalState(
        key,
        value
    ) {

        this.state.internal_truth
            .physiological_state[key] =
            deepClone(value);

        return true;
    }


    getPathophysiology() {

        return deepClone(
            this.state.internal_truth
                .pathophysiology
        );
    }


    /* ============================================================
     * INTERVENÇÕES
     * ============================================================ */

    addIntervention(
        intervention
    ) {

        if (!intervention) {
            return null;
        }

        const record = {

            id:
                intervention.id ||
                createId("intervention"),

            time:
                Number.isFinite(
                    intervention.time
                )
                    ? intervention.time
                    : this.getCurrentTime(),

            action:
                intervention.action ||
                null,

            parameters:
                ensureObject(
                    intervention.parameters
                ),

            state_before:
                deepClone(
                    intervention.state_before ||
                    {}
                ),

            effects:
                ensureArray(
                    intervention.effects
                ),

            state_after:
                deepClone(
                    intervention.state_after ||
                    {}
                ),

            status:
                intervention.status ||
                "completed"
        };

        this.state.interventions
            .push(record);

        return record.id;
    }


    getInterventions() {

        return deepClone(
            this.state.interventions
        );
    }


    getLastIntervention() {

        const list =
            this.state.interventions;

        if (!list.length) {
            return null;
        }

        return deepClone(
            list[list.length - 1]
        );
    }


    /* ============================================================
     * EVOLUÇÃO TEMPORAL
     * ============================================================ */

    getCurrentTime() {

        return this.state.evolution
            .current_time;
    }


    advanceTime(
        amount
    ) {

        const delta =
            Number(amount);

        if (
            !Number.isFinite(delta) ||
            delta < 0
        ) {
            return false;
        }

        this.state.evolution
            .current_time += delta;

        return true;
    }


    addEvolutionEvent(
        event
    ) {

        if (!event) {
            return null;
        }

        const record = {

            id:
                event.id ||
                createId("event"),

            time:
                Number.isFinite(
                    event.time
                )
                    ? event.time
                    : this.getCurrentTime(),

            type:
                event.type ||
                "clinical_event",

            description:
                event.description ??
                null,

            effects:
                ensureArray(
                    event.effects
                ),

            metadata:
                ensureObject(
                    event.metadata
                )
        };

        this.state.evolution
            .events
            .push(record);

        return record.id;
    }


    getEvolutionEvents() {

        return deepClone(
            this.state.evolution
                .events
        );
    }


    /* ============================================================
     * SNAPSHOT
     * ============================================================ */

    createSnapshot() {

        return {

            time:
                this.getCurrentTime(),

            vitals:
                this.getVitals(),

            physical_exam:
                this.getPhysicalExam(),

            physiological_state:
                this.getPhysiologicalState(),

            complications:
                deepClone(
                    this.state.internal_truth
                        .complications
                )
        };
    }


    recordTrajectoryPoint(
        label = null
    ) {

        const snapshot =
            this.createSnapshot();

        this.state.evolution
            .trajectory
            .push({

                time:
                    snapshot.time,

                label,

                state:
                    snapshot
            });

        this.state.evolution
            .current_state =
            deepClone(snapshot);

        return snapshot;
    }


    getTrajectory() {

        return deepClone(
            this.state.evolution
                .trajectory
        );
    }


    /* ============================================================
     * COMPLICAÇÕES
     * ============================================================ */

    addComplication(
        complication
    ) {

        if (!complication) {
            return false;
        }

        const exists =
            this.state.internal_truth
                .complications
                .some(
                    item =>
                        item === complication ||
                        item?.id === complication?.id
                );

        if (!exists) {

            this.state.internal_truth
                .complications
                .push(
                    deepClone(complication)
                );
        }

        return true;
    }


    removeComplication(
        complication
    ) {

        const list =
            this.state.internal_truth
                .complications;

        const index =
            list.findIndex(
                item =>
                    item === complication ||
                    item?.id === complication?.id
            );

        if (index === -1) {
            return false;
        }

        list.splice(index, 1);

        return true;
    }


    getComplications() {

        return deepClone(
            this.state.internal_truth
                .complications
        );
    }


    /* ============================================================
     * METADATA
     * ============================================================ */

    setCaseId(
        caseId
    ) {

        this.state.metadata.case_id =
            caseId ?? null;

        return true;
    }


    setKnowledgeBaseId(
        knowledgeBaseId
    ) {

        this.state.metadata
            .knowledge_base_id =
            knowledgeBaseId ?? null;

        return true;
    }


    setStatus(
        status
    ) {

        this.state.metadata.status =
            status;

        return true;
    }


    getStatus() {

        return this.state.metadata
            .status;
    }


    /* ============================================================
     * SERIALIZAÇÃO
     * ============================================================ */

    toJSON() {

        return deepClone(
            this.state
        );
    }


    toJSONSafe() {

        const copy =
            this.toJSON();

        /*
         * Método reservado para futuras interfaces
         * que precisem de uma representação pública.
         *
         * NÃO remover internal_truth daqui sem antes
         * implementar explicitamente o mecanismo de
         * exposição segura.
         */

        return copy;
    }


    /* ============================================================
     * RESET / RESTAURAÇÃO
     * ============================================================ */

    restore(
        state
    ) {

        if (!isObject(state)) {
            return false;
        }

        this.state =
            this.normalizeState(
                state
            );

        this.validate();

        return true;
    }


    clone() {

        return new PatientState(
            this.toJSON()
        );
    }


    /* ============================================================
     * DEBUG
     * ============================================================ */

    summary() {

        return {

            id:
                this.getId(),

            case_id:
                this.getCaseId(),

            knowledge_base_id:
                this.getKnowledgeBaseId(),

            age:
                this.state.demographics.age,

            sex:
                this.state.demographics.sex,

            chief_complaint:
                this.state.presentation
                    .chief_complaint
                    .primary,

            symptoms:
                this.getSymptoms(),

            current_time:
                this.getCurrentTime(),

            interventions:
                this.state.interventions.length,

            investigations_requested:
                this.state.investigations
                    .requested.length,

            investigations_performed:
                this.state.investigations
                    .performed.length,

            evolution_events:
                this.state.evolution
                    .events.length
        };
    }
}


/* ============================================================
 * EXPORTAÇÃO
 * ============================================================ */

if (
    typeof window !== "undefined"
) {
    window.PatientState =
        PatientState;
}


if (
    typeof module !== "undefined" &&
    module.exports
) {
    module.exports =
        PatientState;
}


/* ============================================================
 * FIM
 * ============================================================ */
