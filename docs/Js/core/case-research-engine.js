(function (global) {
  "use strict";

  /**
   * CaseResearchEngine
   *
   * Responsible for the evidence step that occurs before a generated case
   * is presented and for explicit research requests during a simulation.
   *
   * It deliberately does not scrape websites itself. A research provider
   * is injected through window.DiagnosysResearchProvider. This keeps the
   * clinical engine independent from the transport/backend used to reach
   * MSD, Ministério da Saúde, PubMed, PMC, etc.
   */
  class CaseResearchEngine {

    constructor(options) {
      options = options || {};

      this.config = options.config || {};
      this.provider = options.provider || global.DiagnosysResearchProvider || null;
    }

    setProvider(provider) {
      this.provider = provider || null;
    }

    enabledSources() {
      return (this.config.sources || [])
        .filter(function (source) {
          return source && source.enabled !== false;
        })
        .sort(function (a, b) {
          return (a.priority || 99) - (b.priority || 99);
        });
    }

    buildQueries(caseSource) {
      caseSource = caseSource || {};

      var concept =
        caseSource.primary_concept ||
        caseSource.concept ||
        caseSource.disease ||
        caseSource.title ||
        "";

      var anchors = []
        .concat(caseSource.anchors || [])
        .concat(caseSource.clinical_anchors || []);

      var templates = this.config.query_templates || [
        "{concept} apresentação clínica",
        "{concept} sintomas sinais exame físico",
        "{concept} diagnóstico investigação exames",
        "{concept} tratamento manejo",
        "{concept} complicações evolução"
      ];

      var queries = templates.map(function (template) {
        return template.replace(/\{concept\}/g, concept);
      });

      anchors.slice(0, 5).forEach(function (anchor) {
        if (!anchor) return;
        queries.push(concept + " " + anchor);
      });

      return Array.from(new Set(
        queries.filter(function (query) {
          return query.trim().length > 0;
        })
      ));
    }

    async searchCase(caseSource) {
      if (this.config.enabled === false) {
        return {
          enabled: false,
          queries: [],
          evidence: [],
          source_status: []
        };
      }

      var sources = this.enabledSources();
      var queries = this.buildQueries(caseSource);
      var evidence = [];
      var sourceStatus = [];
      var maximum = Number(
        this.config.query_policy &&
        this.config.query_policy.maximum_queries_per_source
      ) || 6;

      if (!this.provider || typeof this.provider.search !== "function") {
        return {
          enabled: true,
          queries: queries,
          evidence: [],
          source_status: sources.map(function (source) {
            return {
              source_id: source.id,
              source_name: source.name,
              status: "provider_unavailable"
            };
          })
        };
      }

      for (var i = 0; i < sources.length; i += 1) {
        var source = sources[i];
        var sourceEvidenceCount = 0;
        var sourceError = null;

        for (var q = 0; q < Math.min(queries.length, maximum); q += 1) {
          var query = queries[q];

          try {
            var result = await this.provider.search(query, {
              source: source.id,
              source_name: source.name,
              base_url: source.base_url
            });

            if (result) {
              evidence.push({
                source_id: source.id,
                source_name: source.name,
                query: query,
                retrieved_at: new Date().toISOString(),
                result: result
              });
              sourceEvidenceCount += 1;
            }
          } catch (error) {
            sourceError = error instanceof Error ? error.message : String(error);
          }
        }

        sourceStatus.push({
          source_id: source.id,
          source_name: source.name,
          status: sourceError
            ? "error"
            : sourceEvidenceCount > 0
              ? "ok"
              : "no_results",
          evidence_count: sourceEvidenceCount,
          error: sourceError
        });
      }

      return {
        enabled: true,
        queries: queries,
        evidence: evidence,
        source_status: sourceStatus
      };
    }

    async researchQuestion(question, context) {
      if (!question || !String(question).trim()) {
        return null;
      }

      if (!this.provider || typeof this.provider.search !== "function") {
        return {
          status: "provider_unavailable",
          question: question,
          evidence: []
        };
      }

      var sources = this.enabledSources();
      var evidence = [];

      for (var i = 0; i < sources.length; i += 1) {
        var source = sources[i];

        try {
          var result = await this.provider.search(question, {
            source: source.id,
            source_name: source.name,
            base_url: source.base_url,
            context: context || null
          });

          if (result) {
            evidence.push({
              source_id: source.id,
              source_name: source.name,
              query: question,
              retrieved_at: new Date().toISOString(),
              result: result
            });
          }
        } catch (error) {
          evidence.push({
            source_id: source.id,
            source_name: source.name,
            query: question,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return {
        status: evidence.length ? "ok" : "no_results",
        question: question,
        evidence: evidence
      };
    }
  }

  global.CaseResearchEngine = CaseResearchEngine;
})(window);
