(function (global) {
  "use strict";

  /**
   * CaseBuilder
   *
   * Converts a library case/model plus external evidence into the internal
   * Clinical Case Model used by the simulation. It does not expose the
   * hidden diagnosis and it does not mutate the original library object.
   */
  class CaseBuilder {

    constructor(options) {
      options = options || {};
      this.caseSource = options.caseSource || {};
      this.research = options.research || {};
    }

    build() {
      var source = this.caseSource;
      var patient = source.patient || {};
      var opening = source.opening || source.presentation || {};

      var clinicalCase = {
        case_id: source.id || source.case_id || "generated_" + Date.now(),

        patient: Object.assign({}, patient),

        presentation: {
          chief_complaint:
            source.chief_complaint ||
            (typeof opening === "object" ? opening.chief_complaint : null) ||
            source.opening ||
            "Queixa principal não informada.",

          initial_narrative:
            source.initial_narrative ||
            (typeof opening === "object" ? opening.initial_narrative : null) ||
            this.buildNarrative(),

          vitals:
            source.vitals ||
            source.physical_exam && source.physical_exam.vitals ||
            {}
        },

        initial_state: Object.assign({
          stability: "estável",
          severity: "não classificada"
        }, source.initial_state || {}),

        history: this.clone(source.history || {}),

        physical_exam: this.clone(
          source.physical_exam || {}
        ),

        investigations: this.buildInvestigations(source),

        management: this.clone(
          source.management || {
            possible_actions: source.possible_actions || []
          }
        ),

        evolution: this.clone(
          source.evolution || {
            temporal_evolution: source.temporal_evolution || [],
            consequences: source.consequences || {}
          }
        ),

        hidden: {
          diagnosis:
            source.hidden && source.hidden.diagnosis ||
            source.primary_concept ||
            source.concept ||
            null,

          label:
            source.hidden && source.hidden.label ||
            source.title ||
            source.primary_concept ||
            source.concept ||
            null,

          pathophysiology:
            source.hidden && source.hidden.pathophysiology ||
            {},

          differential:
            source.hidden && source.hidden.differential ||
            source.differential ||
            []
        },

        evidence: this.clone(
          this.research.evidence || []
        ),

        revelation_state: {
          initial_presentation: true,
          revealed_history: [],
          revealed_physical_findings: [],
          performed_investigations: [],
          revealed_results: [],
          revealed_future_events: []
        },

        metadata: {
          source_library_case_id: source.id || source.case_id || null,
          generated_at: new Date().toISOString(),
          evidence_sources: (this.research.source_status || []).map(function (item) {
            return {
              source_id: item.source_id,
              source_name: item.source_name,
              status: item.status
            };
          })
        }
      };

      return clinicalCase;
    }

    buildInvestigations(source) {
      var result = this.clone(source.investigations || {});
      var propedeutics = this.clone(source.propedeutics || []);
      var catalog = Array.isArray(result.catalog) ? result.catalog : [];
      var entries = [];

      // The CBC is part of the complete case truth when supplied by the case.
      if (source.initial_cbc) {
        entries.push({
          id: "initial_cbc",
          exam: "hemograma",
          name: "Hemograma",
          result: this.clone(source.initial_cbc),
          interpretation: this.inferCbcInterpretation(source.initial_cbc),
          available: true,
          performed: false,
          source: "case.initial_cbc"
        });
      }

      propedeutics.forEach(function (item) {
        if (!item) return;
        var exam = item.exam || item.name || item.id;
        if (!exam) return;

        var resultValue = this.resolveInvestigationResult(item);

        entries.push({
          id: item.id || this.slug(exam),
          exam: exam,
          name: item.name || exam,
          result: resultValue,
          interpretation: item.interpretation || null,
          expected_result: item.expected_result,
          possible_results: Array.isArray(item.possible_results) ? item.possible_results.slice() : null,
          available: true,
          performed: false,
          source: "case.propedeutics"
        });
            }, this);

      catalog.forEach(function (item) {
        if (!item) return;
        var exam = item.exam || item.name || item.id;
        if (!exam) return;
        var existing = entries.find(function (entry) {
          return this.slug(entry.exam) === this.slug(exam);
        }, this);
        if (existing) return;

        var normalized = Object.assign({}, item);
        normalized.id = normalized.id || this.slug(exam);
        normalized.exam = exam;
        normalized.name = normalized.name || exam;
        normalized.result = this.resolveInvestigationResult(normalized);
        normalized.available = normalized.available !== false;
        normalized.performed = false;
        entries.push(normalized);
      }, this);

      // Every available investigation must have a concrete case result.
      // The result is created at case-build time, never at the moment of request.
      var invalid = entries.filter(function (entry) {
        return entry.available !== false &&
          (entry.result === undefined || entry.result === null || entry.result === "");
      });

      if (invalid.length) {
        throw new Error(
          "Caso " +
          (source.id || source.case_id || "sem_id") +
          " possui investigações disponíveis sem resultado definido: " +
          invalid.map(function (item) { return item.exam; }).join(", ")
        );
      }

      var unique = [];
      entries.forEach(function (entry) {
        var key = this.slug(entry.exam);
        if (!unique.some(function (item) { return this.slug(item.exam) === key; }, this)) {
          unique.push(entry);
        }
      }, this);

      result.catalog = unique;
      result.available = unique
        .filter(function (item) { return item.available !== false; })
        .map(function (item) {
          return {
            id: item.id,
            exam: item.exam,
            name: item.name,
            result: this.clone(item.result),
            interpretation: item.interpretation || null,
            performed: false
          };
        }, this);

      result.results = {};
      unique.forEach(function (item) {
        if (item.available !== false) {
          result.results[this.slug(item.exam)] = this.clone(item.result);
        }
      }, this);

      result.initial_cbc = source.initial_cbc
        ? this.clone(source.initial_cbc)
        : null;

      result.initial_cbc_performed = false;
      result.completed_at_build = true;
      result.result_policy = {
        all_available_investigations_have_prebuilt_results: true,
        generated_at_case_build: true,
        reveal_only_after_request: true
      };

      return result;
    }

    resolveInvestigationResult(item) {
      if (item && item.result !== undefined && item.result !== null && item.result !== "") {
        return this.clone(item.result);
      }

      if (item && item.expected_result !== undefined && item.expected_result !== null) {
        return this.clone(item.expected_result);
      }

      if (Array.isArray(item && item.possible_results) && item.possible_results.length) {
        // The case is fictional. Choose one of the results explicitly allowed
        // by the case model, and freeze it now so later turns cannot change it.
        return this.clone(
          item.possible_results[
            this.deterministicIndex(
              item.exam || item.name || item.id,
              item.possible_results.length
            )
          ]
        );
      }

      return null;
    }

    deterministicIndex(seed, length) {
      if (!length) return 0;
      var text = String(seed || "");
      var hash = 0;
      for (var i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash) % length;
    }

    slug(value) {
      return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    }

    inferCbcInterpretation(cbc) {
      if (!cbc || typeof cbc !== "object") return null;
      var hb = Number(cbc.hemoglobin_g_dl);
      var mcv = Number(cbc.mcv_fl);
      var wbc = Number(cbc.wbc_per_mm3);
      var platelets = Number(cbc.platelets_per_mm3);
      var findings = [];

      if (Number.isFinite(hb)) {
        findings.push(hb < 12 ? "anemia" : "hemoglobina sem anemia evidente");
      }
      if (Number.isFinite(mcv)) {
        findings.push(mcv < 80 ? "microcitose" : mcv > 100 ? "macrocitose" : "VCM em faixa normocítica");
      }
      if (Number.isFinite(wbc)) {
        findings.push(wbc >= 4000 && wbc <= 11000 ? "leucócitos sem leucocitose evidente" : "leucograma fora da faixa habitual");
      }
      if (Number.isFinite(platelets)) {
        findings.push(platelets >= 150000 && platelets <= 450000 ? "plaquetas sem trombocitose evidente" : "plaquetas fora da faixa habitual");
      }

      return findings.join("; ");
    }

    buildNarrative() {
      var patient = this.caseSource.patient || {};
      var sex = String(patient.sex || "").toLowerCase();
      var subject = sex === "feminino" || sex === "female"
        ? "Uma mulher"
        : sex === "masculino" || sex === "male"
          ? "Um homem"
          : "Um paciente";

      var age = patient.age !== undefined
        ? patient.age + " anos"
        : "idade não informada";

      var opening = this.caseSource.opening;

      if (opening) {
        return subject + ", " + age + ", chega para avaliação por " + String(opening).replace(/[.]$/, ".");
      }

      return subject + ", " + age + ", chega para avaliação clínica.";
    }

    clone(value) {
      if (value === undefined || value === null) {
        return value;
      }

      return JSON.parse(JSON.stringify(value));
    }
  }

  global.CaseBuilder = CaseBuilder;
})(window);
