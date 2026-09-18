(() => {
  "use strict";

  const clone = value => {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  };

  const normalize = value => String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const shuffle = list => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  class CasePreparationEngine {
    constructor(options = {}) {
      this.engine = options.engine || window.idmtEngine || null;
      this.catalogPath = options.catalogPath || "knowledge_base/diagnosys_catalogo_mestre_doencas.json";
      this.catalog = null;
      this.preparedCases = [];
    }

    async loadMasterCatalog(onStatus) {
      onStatus?.("catálogo mestre", "carregando");
      try {
        const response = await fetch(this.catalogPath, { cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        this.catalog = await response.json();
        onStatus?.("catálogo mestre", "ok", (this.catalog.entries?.length || 0) + " conceitos");
        return this.catalog;
      } catch (error) {
        onStatus?.("catálogo mestre", "opcional", "arquivo ainda não disponível");
        return null;
      }
    }

    chooseSourceCases(count = 3) {
      const sourceCases = Array.isArray(this.engine?.library?.cases)
        ? this.engine.library.cases
        : [];

      const usable = sourceCases.filter(item =>
        item && (item.id || item.case_id) && (item.primary_concept || item.concept || item.title)
      );

      if (usable.length < count) {
        throw new Error("A biblioteca clínica possui apenas " + usable.length + " casos utilizáveis; são necessários " + count + ".");
      }

      return shuffle(usable).slice(0, count).map(clone);
    }

    async researchAndBuild(sourceCase, index, onStatus) {
      const concept = sourceCase.primary_concept || sourceCase.concept || sourceCase.title || ("caso_" + index);
      onStatus?.("caso " + (index + 1), "pesquisando", concept);

      let evidence = { enabled: false, evidence: [], source_status: [] };

      if (window.CaseResearchEngine && this.engine?.researchRules) {
        try {
          const researcher = new window.CaseResearchEngine({
            config: this.engine.researchRules,
            provider: window.DiagnosysResearchProvider || null
          });
          evidence = await researcher.research(sourceCase);
        } catch (error) {
          evidence = {
            enabled: true,
            evidence: [],
            source_status: [{ status: "error", error: error.message || String(error) }]
          };
        }
      }

      onStatus?.("caso " + (index + 1), "construindo", "modelo clínico completo");

      let clinicalCase;
      if (window.CaseBuilder) {
        clinicalCase = new window.CaseBuilder({
          caseSource: sourceCase,
          research: evidence
        }).build();
      } else {
        clinicalCase = clone(sourceCase);
      }

      this.validate(clinicalCase);
      onStatus?.("caso " + (index + 1), "pronto", "caso validado");
      return clinicalCase;
    }

    validate(clinicalCase) {
      const required = [
        "case_id", "patient", "presentation", "initial_state",
        "history", "physical_exam", "investigations",
        "management", "evolution", "hidden"
      ];

      const missing = required.filter(key => clinicalCase?.[key] == null);
      if (missing.length) throw new Error("Campos clínicos ausentes: " + missing.join(", "));
      if (!clinicalCase.hidden?.diagnosis) throw new Error("Caso sem diagnóstico interno.");
      if (!clinicalCase.presentation?.chief_complaint) throw new Error("Caso sem queixa principal.");
      return true;
    }

    cardData(clinicalCase, index) {
      const patient = clinicalCase.patient || {};
      const presentation = clinicalCase.presentation || {};
      const sex = normalize(patient.sex) === "masculino"
        ? "Homem"
        : normalize(patient.sex) === "feminino"
          ? "Mulher"
          : "Paciente";

      return {
        index,
        label: "CASO " + (index + 1),
        patient: sex + (patient.age != null ? ", " + patient.age + " anos" : ""),
        complaint: presentation.chief_complaint || "Queixa não informada.",
        difficulty: clinicalCase.metadata?.difficulty || clinicalCase.difficulty || "Simulação clínica",
        case: clinicalCase
      };
    }

    async prepare(count = 3, onStatus) {
      this.preparedCases = [];
      await this.loadMasterCatalog(onStatus);
      const sourceCases = this.chooseSourceCases(count);

      for (let i = 0; i < sourceCases.length; i += 1) {
        const built = await this.researchAndBuild(sourceCases[i], i, onStatus);
        this.preparedCases.push(this.cardData(built, i));
      }

      if (this.preparedCases.length !== count) {
        throw new Error("Não foi possível preparar os três casos clínicos.");
      }

      return this.preparedCases;
    }

    backgroundWarmup() {
      const jobs = [
        () => fetch("knowledge_base/reference_ranges.json", { cache: "force-cache" }).catch(() => null),
        () => fetch("knowledge_base/pcdt_catalog.json", { cache: "force-cache" }).catch(() => null)
      ];

      const run = () => Promise.all(jobs.map(job => job()));
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => run(), { timeout: 2500 });
      } else {
        window.setTimeout(run, 500);
      }
    }
  }

  window.CasePreparationEngine = CasePreparationEngine;
})();
