(() => {
  "use strict";

  const clone = value => {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  };

  const normalize = value => String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ")
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
      this.clinicalCatalog = window.ClinicalDiseaseCatalog
        ? new window.ClinicalDiseaseCatalog({ path: this.catalogPath })
        : null;
      this.playableCatalog = [];
      this.preparedCases = [];
    }

    async loadClinicalCatalogModule() {
      if (window.ClinicalDiseaseCatalog) return true;
      return new Promise((resolve) => {
        const existing = Array.from(document.scripts).find(script =>
          script.src.endsWith("Js/core/clinical-disease-catalog.js")
        );
        if (existing) {
          existing.addEventListener("load", () => resolve(true), { once: true });
          existing.addEventListener("error", () => resolve(false), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = "Js/core/clinical-disease-catalog.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });
    }

    async loadMasterCatalog(onStatus) {
      onStatus?.("catálogo mestre", "carregando");
      await this.loadClinicalCatalogModule();
      try {
        if (this.clinicalCatalog) {
          this.catalog = await this.clinicalCatalog.load();
          this.playableCatalog = await this.clinicalCatalog.getPlayableEntries();
        } else {
          const response = await fetch(this.catalogPath, { cache: "no-store" });
          if (!response.ok) throw new Error("HTTP " + response.status);
          this.catalog = await response.json();
          this.playableCatalog = Array.isArray(this.catalog.entries) ? this.catalog.entries : [];
        }

        onStatus?.(
          "catálogo mestre",
          "ok",
          (this.catalog.entries?.length || 0) + " conceitos · " +
          this.playableCatalog.length + " elegíveis para casos"
        );
        return this.catalog;
      } catch (error) {
        onStatus?.("catálogo mestre", "aviso", "não foi possível carregar o catálogo");
        this.catalog = null;
        this.playableCatalog = [];
        return null;
      }
    }

    isPlayableCase(item) {
      if (!item) return false;
      const concept = item.primary_concept || item.concept || item.title;
      if (!concept) return false;

      if (!this.playableCatalog.length) return true;

      const n = normalize(concept);
      return this.playableCatalog.some(entry => {
        const name = normalize(entry.name);
        return name === n || name.includes(n) || n.includes(name);
      });
    }

    catalogEntryFor(item) {
      const concept = item?.primary_concept || item?.concept || item?.title || "";
      const n = normalize(concept);
      return this.playableCatalog.find(entry => {
        const name = normalize(entry.name);
        return name === n || name.includes(n) || n.includes(name);
      }) || null;
    }

    specialtyFromCase(item) {
      const source = normalize(item?.kb_source || "");
      const explicit = normalize(item?.specialty || item?.especialidade || item?.metadata?.specialty || "");
      const text = normalize([
        explicit,
        item?.primary_concept,
        item?.concept,
        item?.title,
        item?.hidden?.diagnosis
      ].filter(Boolean).join(" | "));

      if (/(cardiologia|cardiopatias|cardiologia)/.test(source) || /\b(cardiolog|infarto|iam|stemi|angina|arritmia|bloqueio atrioventricular|insuficiencia cardiaca|fibrilacao atrial|hipertensao)\b/.test(text)) return "cardiologia";
      if (/endocrinologia/.test(source) || /\b(endocrin|diabetes|tireoide|hipotireoid|hipertireoid|dislipidemia|hipofise|adrenal)\b/.test(text)) return "endocrinologia";
      if (/pneumologia|dispneia/.test(source) || /\b(pneumolog|asma|dpoc|pneumonia|dispneia|embolia pulmonar)\b/.test(text)) return "pneumologia";
      if (/neurologia/.test(source) || /\b(neurolog|epileps|avc|demencia|cefaleia|meningite)\b/.test(text)) return "neurologia";
      if (/reumatologia/.test(source) || /\b(reumatolog|artrite|lupus|vasculite|gota)\b/.test(text)) return "reumatologia";
      if (/cirurgia/.test(source) || /\b(cirurg|apendic|colecist|hernia|abdome agudo)\b/.test(text)) return "cirurgia";
      if (/anemia|hematologia/.test(source) || /\b(hematolog|anemia|hemolise|leucemia|linfoma)\b/.test(text)) return "hematologia";
      if (/hipertensao/.test(source) || /\b(hipertensao arterial)\b/.test(text)) return "clinica_medica";
      return "clinica_medica";
    }

    specialtyLabel(value) {
      const labels = {
        todos: "Todas as especialidades",
        cardiologia: "Cardiologia",
        endocrinologia: "Endocrinologia",
        pneumologia: "Pneumologia",
        neurologia: "Neurologia",
        reumatologia: "Reumatologia",
        cirurgia: "Cirurgia",
        hematologia: "Hematologia",
        clinica_medica: "Clínica médica"
      };
      return labels[value] || value || "Todas as especialidades";
    }

    chooseSourceCases(count = 3, specialty = "todos") {
      const sourceCases = Array.isArray(this.engine?.library?.cases)
        ? this.engine.library.cases
        : [];

      /*
       * UNIVERSAL KNOWLEDGE BASE:
       * O conceito não precisa existir no catálogo mestre para ser usado.
       * O catálogo é enriquecimento/validação auxiliar; a fonte real de
       * seleção é o universo clínico carregado pelo CaseLibrary.
       */
      const normalizedSpecialty = normalize(specialty || "todos").replace(/ /g, "_");
      const usable = sourceCases.filter(item =>
        item &&
        (item.id || item.case_id) &&
        (item.primary_concept || item.concept || item.title) &&
        this.isPlayableCase(item) &&
        (normalizedSpecialty === "todos" || this.specialtyFromCase(item) === normalizedSpecialty)
      );

      if (!usable.length) {
        throw new Error(
          "A biblioteca clínica não possui casos elegíveis para " +
          this.specialtyLabel(normalizedSpecialty) + "."
        );
      }

      const targetCount = Math.min(count, usable.length);

      return shuffle(usable).slice(0, targetCount).map(item => {
        const copy = clone(item);
        copy.specialty = this.specialtyFromCase(copy);
        copy.specialty_label = this.specialtyLabel(copy.specialty);
        const catalogEntry = this.catalogEntryFor(copy);
        copy.catalog_context = catalogEntry
          ? {
              concept: catalogEntry.name,
              sources: clone(catalogEntry.sources || [])
            }
          : null;
        return copy;
      });
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

      onStatus?.(
        "caso " + (index + 1),
        "construindo",
        "modelo clínico completo · referências: " +
        ((sourceCase.catalog_context?.sources || []).join(", ") || "catálogo")
      );

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
      if (clinicalCase.clinical_truth?.conversation_ready !== true) {
        throw new Error("Caso " + (sourceCase.id || index) + " ainda não possui verdade clínica conversacional completa.");
      }
      onStatus?.("caso " + (index + 1), "memória clínica", "história · sintomas · exame · exames · manejo prontos");
      onStatus?.("caso " + (index + 1), "pronto", "caso pesquisado, construído e validado");
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

      const investigations = clinicalCase.investigations || {};
      const available = Array.isArray(investigations.available) ? investigations.available : [];
      const catalog = Array.isArray(investigations.catalog) ? investigations.catalog : [];

      if (!available.length) throw new Error("Caso sem investigações disponíveis.");

      const missingResults = available.filter(item => {
        const result = item?.result;
        return result === undefined || result === null || result === "";
      });

      if (missingResults.length) {
        throw new Error(
          "Investigações disponíveis sem resultado pré-construído: " +
          missingResults.map(item => item?.exam || item?.name || item?.id || "exame").join(", ")
        );
      }

      const catalogWithoutResults = catalog.filter(item => {
        if (item?.available === false) return false;
        return item?.result === undefined || item?.result === null || item?.result === "";
      });

      if (catalogWithoutResults.length) {
        throw new Error(
          "Catálogo de investigações incompleto: " +
          catalogWithoutResults.map(item => item?.exam || item?.name || item?.id || "exame").join(", ")
        );
      }

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

    async prepare(count = 3, onStatus, specialty = "todos") {
      this.preparedCases = [];
      await this.loadMasterCatalog(onStatus);
      const normalizedSpecialty = normalize(specialty || "todos").replace(/ /g, "_");
      const sourceCases = this.chooseSourceCases(count, normalizedSpecialty);

      const builtCases = await Promise.all(
        sourceCases.map((sourceCase, index) => this.researchAndBuild(sourceCase, index, onStatus))
      );

      this.preparedCases = builtCases.map((built, index) => this.cardData(built, index));

      if (!this.preparedCases.length) {
        throw new Error("Nenhum caso clínico completo foi preparado para " + this.specialtyLabel(normalizedSpecialty) + ".");
      }

      return this.preparedCases;
    }

    backgroundWarmup() {
      const jobs = [
        () => fetch("knowledge_base/reference_ranges.json", { cache: "force-cache" }).catch(() => null),
        () => fetch("knowledge_base/pcdt_catalog.json", { cache: "force-cache" }).catch(() => null),
        () => fetch(this.catalogPath, { cache: "force-cache" }).catch(() => null)
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
