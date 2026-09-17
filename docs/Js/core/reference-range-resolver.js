(function (global) {
  "use strict";

  /**
   * ReferenceRangeResolver
   *
   * Reads the common laboratory reference table and exposes lookup helpers.
   * It is intentionally separate from patient results: a reference range is
   * contextual guidance, never the truth of a simulated patient's result.
   */
  class ReferenceRangeResolver {

    constructor(data) {
      data = data || {};
      this.data = data;
      this.tests = Array.isArray(data.tests) ? data.tests : [];
    }

    normalize(value) {
      return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    find(query) {
      var normalized = this.normalize(query);

      if (!normalized) {
        return null;
      }

      return this.tests.find(function (test) {
        var candidates = [test.name].concat(test.aliases || []);
        return candidates.some(function (candidate) {
          var value = this.normalize(candidate);
          return value === normalized ||
            value.indexOf(normalized) !== -1 ||
            normalized.indexOf(value) !== -1;
        }, this);
      }, this) || null;
    }

    get(query, context) {
      var test = this.find(query);

      if (!test) {
        return null;
      }

      var contextKey = this.contextKey(context || {});
      var reference = test.reference &&
        (test.reference[contextKey] || test.reference.adult || test.reference.adult_male || test.reference.adult_female);

      return {
        id: test.id,
        name: test.name,
        unit: test.unit,
        reference: reference || "consultar laboratório",
        all_references: test.reference || {},
        warning: this.data.warning || null,
        source: this.data.primary_reference || null
      };
    }

    contextKey(context) {
      var age = Number(context.age);
      var sex = String(context.sex || "").toLowerCase();

      if (age < 18) return "pediatric";
      if (sex === "masculino" || sex === "male") return "adult_male";
      if (sex === "feminino" || sex === "female") return "adult_female";
      return "adult";
    }

    list() {
      return this.tests.map(function (test) {
        return {
          id: test.id,
          name: test.name,
          unit: test.unit,
          reference: test.reference
        };
      });
    }
  }

  global.ReferenceRangeResolver = ReferenceRangeResolver;
})(window);
