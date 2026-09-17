"use strict";

/**
 * Runtime compatibility layer for the v3 knowledge/state contract.
 * Kept isolated so the legacy modules can be removed incrementally.
 */

(function (global) {

    function normalize(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    }

    function relationType(relation) {
        return relation?.type || relation?.relationship || relation?.relation || null;
    }

    if (typeof global.PatientState === "function") {
        const OriginalPatientState = global.PatientState;
        global.PatientState = function (initialState = {}) {
            const raw = initialState?.vitals || {};
            let bloodPressure = raw.blood_pressure || raw.bloodPressure || raw.pa || null;
            if (typeof bloodPressure === "string") {
                const match = bloodPressure.match(/(\d+)\s*\/\s*(\d+)/);
                bloodPressure = match ? { systolic: Number(match[1]), diastolic: Number(match[2]) } : null;
            }
            const normalized = {
                ...initialState,
                vitals: {
                    heart_rate: raw.heart_rate ?? raw.heartRate ?? raw.fc ?? null,
                    respiratory_rate: raw.respiratory_rate ?? raw.respiratoryRate ?? raw.fr ?? null,
                    oxygen_saturation: raw.oxygen_saturation ?? raw.oxygenSaturation ?? raw.spo2 ?? raw.SpO2 ?? null,
                    blood_pressure: bloodPressure || { systolic: null, diastolic: null },
                    temperature: raw.temperature ?? raw.temp ?? null,
                    glucose: raw.glucose ?? raw.glicemia ?? null
                }
            };
            return new OriginalPatientState(normalized);
        };
        global.PatientState.prototype = OriginalPatientState.prototype;
    }

    if (typeof global.ClinicalModel === "function") {
        const originalBuildIndexes = global.ClinicalModel.prototype.buildIndexes;
        global.ClinicalModel.prototype.buildIndexes = function () {
            this.relationships = this.relationships.map(relation => ({ ...relation, type: relationType(relation) }));
            return originalBuildIndexes.call(this);
        };
    }

    if (typeof global.PossibilityEngine === "function") {
        global.PossibilityEngine.prototype.getDiseaseEntities = function () {
            const allowed = new Set(["disease", "condition", "disorder", "syndrome", "diagnosis"]);
            return this.model.getEntities().filter(entity => {
                const type = normalize(entity?.type || entity?.entity_type || entity?.classification?.type);
                const category = normalize(entity?.category);
                return allowed.has(type) || allowed.has(category);
            });
        };

        global.PossibilityEngine.prototype.getPossibleManifestations = function (entityId) {
            const result = [];
            const source = this.model.getEntity(entityId);
            const relations = this.model.getRelationshipsFrom(entityId) || [];
            for (const relation of relations) {
                if (!["characterized_by", "manifests_as", "presents_with"].includes(relationType(relation))) continue;
                const target = relation.target || relation.target_id || relation.to;
                const entity = this.model.getEntity(target);
                if (entity) result.push({ entity, relationship: relation });
            }
            const clinical = source?.clinical;
            for (const presentation of Array.isArray(clinical?.presentations) ? clinical.presentations : []) {
                for (const finding of Array.isArray(presentation?.findings) ? presentation.findings : []) {
                    const id = typeof finding === "string" ? finding : finding?.id || finding?.entity_id || finding?.name;
                    if (!id) continue;
                    const entity = this.model.getEntity(id) || (typeof finding === "object" ? finding : { id, name: id, type: "finding" });
                    result.push({ entity, relationship: { type: "presents_with", source: entityId, presentation: presentation.id || null } });
                }
            }
            for (const symptom of Array.isArray(clinical?.symptoms) ? clinical.symptoms : []) {
                const id = typeof symptom === "string" ? symptom : symptom?.id || symptom?.entity_id || symptom?.name;
                if (!id) continue;
                const entity = this.model.getEntity(id) || (typeof symptom === "object" ? symptom : { id, name: id, type: "symptom" });
                result.push({ entity, relationship: { type: "presents_with", source: entityId } });
            }
            const generated = source?.patient_generation?.possible_presentations;
            for (const presentation of Array.isArray(generated) ? generated : []) {
                for (const feature of Array.isArray(presentation?.features) ? presentation.features : []) {
                    if (!feature) continue;
                    result.push({ entity: { id: String(feature), name: String(feature), type: "finding" }, relationship: { type: "presents_with", source: entityId } });
                }
            }
            const seen = new Set();
            return result.filter(item => {
                const key = item.entity?.id || item.entity?.name;
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        };
    }

    if (typeof global.PatientGenerator === "function") {
        global.PatientGenerator.prototype.generateOnset = function (disease, options = {}) {
            if (options.onset) return { ...options.onset };
            const sources = [disease?.patient_generation?.possible_presentations, disease?.clinical?.presentations, disease?.presentations];
            const timingText = sources.flatMap(value => Array.isArray(value) ? value : []).map(item => item?.timing || item?.onset || item?.id || "").join(" ").toLowerCase();
            let type = null;
            if (timingText.includes("crôn") || timingText.includes("cron")) type = "chronic";
            else if (timingText.includes("subagud") || timingText.includes("subacute")) type = "subacute";
            else if (timingText.includes("agud") || timingText.includes("acute")) type = "acute";
            type = options.onsetType || type || (options.mode === "emergency" ? "acute" : "subacute");
            let description = options.onsetDescription || null;
            if (!description && type === "acute") description = `há aproximadamente ${this.randomInt(1, 3)} horas`;
            if (!description && type === "subacute") description = `há aproximadamente ${this.randomInt(2, 7)} dias`;
            if (!description && type === "chronic") description = "de evolução crônica";
            return { type, description };
        };
        const originalClinicalState = global.PatientGenerator.prototype.generateClinicalState;
        global.PatientGenerator.prototype.generateClinicalState = function (disease, severity, presentation = null) {
            const state = originalClinicalState.call(this, disease, severity) || {};
            state.onset = presentation?.onset?.type || state.onset || "subacute";
            return state;
        };
    }

    if (typeof global.ClinicalInterlocutor === "function") {
        global.ClinicalInterlocutor.prototype.hasAny = function (text, terms) {
            return terms.some(term => {
                const normalizedTerm = normalize(term);
                if (/^[a-z0-9]{1,3}$/i.test(normalizedTerm)) return new RegExp(`\\b${normalizedTerm}\\b`, "i").test(text);
                return text.includes(normalizedTerm);
            });
        };
        global.ClinicalInterlocutor.prototype.readPatientValue = function (target) {
            const state = this.patientState;
            if (!state) return undefined;
            const vitals = typeof state.getVitals === "function" ? state.getVitals() : state.vitals || {};
            const maps = {
                heart_rate: ["heart_rate", "heartRate", "fc"], respiratory_rate: ["respiratory_rate", "respiratoryRate", "fr"],
                spo2: ["oxygen_saturation", "oxygenSaturation", "spo2", "SpO2"], blood_pressure: ["blood_pressure", "bloodPressure", "pa"],
                glucose: ["glucose", "glicemia"], temperature: ["temperature", "temp"]
            };
            for (const key of maps[target] || [target]) if (vitals[key] !== undefined) return vitals[key];
            return undefined;
        };
        global.ClinicalInterlocutor.prototype.findPatientInformation = function (keys) {
            const state = this.patientState;
            if (!state) return undefined;
            const presentation = state.getPresentation?.() || {};
            const history = state.getHistory?.() || {};
            for (const source of [presentation, presentation.chief_complaint, history]) {
                for (const key of keys) if (source?.[key] !== undefined) return source[key];
            }
            return undefined;
        };
        global.ClinicalInterlocutor.prototype.findPhysicalExamination = function (target) {
            const exam = this.patientState?.getPhysicalExam?.() || {};
            return exam[target] !== undefined ? exam[target] : undefined;
        };
        global.ClinicalInterlocutor.prototype.findInvestigation = function (target) {
            const investigations = this.patientState?.getInvestigations?.() || {};
            const aliases = { ecg: ["ecg"], blood_gas: ["blood_gas"], hemogram: ["hemogram", "hemograma"], laboratory: ["laboratory"], ct: ["ct", "tc"], chest_xray: ["chest_xray"] };
            for (const key of aliases[target] || [target]) {
                if (investigations.results?.[key] !== undefined) return investigations.results[key];
                if (investigations[key] !== undefined) return investigations[key];
            }
            return undefined;
        };
    }

})(window);
