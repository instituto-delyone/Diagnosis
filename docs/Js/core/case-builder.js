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

      if (!result.available) {
        result.available = propedeutics.map(function (item) {
          return item.exam || item.name || item.id;
        }).filter(Boolean);
      }

      if (!result.catalog && propedeutics.length) {
        result.catalog = propedeutics.map(function (item) {
          return {
            exam: item.exam || item.name || item.id,
            expected_result: item.expected_result,
            possible_results: item.possible_results || null,
            interpretation: item.interpretation || null,
            performed: false
          };
        });
      }

      if (source.initial_cbc) {
        result.initial_cbc = this.clone(source.initial_cbc);
        result.initial_cbc_performed = true;
      }

      return result;
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
