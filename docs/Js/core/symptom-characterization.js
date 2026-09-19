(function (global) {
  "use strict";

  /**
   * SymptomCharacterization
   *
   * Semiologic layer between the prebuilt clinical truth and the conversation.
   * The generic structure applies to symptoms broadly; pain has the classical
   * 10-item pain characterization module.
   */
  class SymptomCharacterization {
    constructor(options) {
      options = options || {};
      this.schema = options.schema || null;
    }

    create(options) {
      options = options || {};
      var source = options.source || {};
      var symptoms = Array.isArray(options.symptoms)
        ? options.symptoms
        : this.normalizeSymptoms(source.symptoms || source);
      if (source.pain && !symptoms.some(function (item) {
        return this.slug(item.id || item.name || item.symptom) === "dor";
      }, this)) {
        symptoms.push(Object.assign({ id: "dor", name: "dor", is_pain: true }, this.clone(source.pain)));
      }
      var result = {};

      symptoms.forEach(function (symptom) {
        var id = this.slug(symptom.id || symptom.name || symptom.symptom);
        if (!id) return;

        var data = Object.assign({}, symptom);
        data.id = id;
        data.name = data.name || data.label || symptom.symptom || id;
        data.is_pain = data.is_pain === true || id === "dor" || id === "pain";
        data.generic = this.pickGeneric(data);
        data.pain = data.is_pain ? this.pickPain(data.pain || data) : null;
        result[id] = data;
      }, this);

      return result;
    }

    normalizeSymptoms(value) {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value.map(function (item) {
          return typeof item === "string" ? { name: item } : item;
        });
      }
      if (typeof value === "object") {
        return Object.keys(value).map(function (key) {
          var item = value[key];
          return Object.assign(
            { id: key, name: key },
            typeof item === "object" && item !== null ? item : { description: item }
          );
        });
      }
      return [{ name: String(value) }];
    }

    pickGeneric(data) {
      var fields = [
        "onset","duration","evolution","frequency","location","distribution",
        "quality","severity","triggers","aggravating_factors","relieving_factors",
        "functional_relations","associated_symptoms","functional_impact"
      ];
      var generic = {};
      fields.forEach(function (field) {
        if (data[field] !== undefined && data[field] !== null && data[field] !== "") {
          generic[field] = this.clone(data[field]);
        }
      }, this);
      return generic;
    }

    pickPain(data) {
      var fields = [
        "location","irradiation","quality","intensity","duration","evolution",
        "functional_relations","triggers_aggravating","relieving_factors",
        "associated_manifestations"
      ];
      var pain = {};
      fields.forEach(function (field) {
        if (data[field] !== undefined && data[field] !== null && data[field] !== "") {
          pain[field] = this.clone(data[field]);
        }
      }, this);

      // Accept the generic aliases commonly used in case files.
      if (pain.triggers_aggravating === undefined) {
        pain.triggers_aggravating = {};
        if (data.triggers !== undefined) pain.triggers_aggravating.triggers = this.clone(data.triggers);
        if (data.aggravating_factors !== undefined) pain.triggers_aggravating.aggravating_factors = this.clone(data.aggravating_factors);
        if (!Object.keys(pain.triggers_aggravating).length) delete pain.triggers_aggravating;
      }
      if (pain.associated_manifestations === undefined && data.associated_symptoms !== undefined) {
        pain.associated_manifestations = this.clone(data.associated_symptoms);
      }
      return pain;
    }

    validatePain(pain) {
      var required = [
        "location","irradiation","quality","intensity","duration","evolution",
        "functional_relations","triggers_aggravating","relieving_factors",
        "associated_manifestations"
      ];
      var missing = required.filter(function (key) {
        return pain === null || pain === undefined ||
          pain[key] === undefined || pain[key] === null || pain[key] === "";
      });
      return {
        valid: missing.length === 0,
        missing: missing
      };
    }

    getPainDecalogue() {
      return [
        "location","irradiation","quality","intensity","duration","evolution",
        "functional_relations","triggers_aggravating","relieving_factors",
        "associated_manifestations"
      ];
    }

    slug(value) {
      return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\\u0300-\\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    }

    clone(value) {
      return value === undefined || value === null
        ? value
        : JSON.parse(JSON.stringify(value));
    }
  }

  global.SymptomCharacterization = SymptomCharacterization;
})(window);
