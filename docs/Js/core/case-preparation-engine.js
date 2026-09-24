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
      this.generationBlueprint = null;
      this.knowledgeAdapter = null;
      this.patientGenerator = null;
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

    async ensureScript(src) {
      if (Array.from(document.scripts).some(script => script.src.endsWith(src))) return true;
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error("Falha ao carregar " + src));
        document.head.appendChild(script);
      });
    }

    async loadGenerationLayer(onStatus) {
      onStatus?.("gerador", "carregando", "carregando o adaptador da Knowledge Base");

      if (!window.KnowledgeBaseAdapter) {
        await this.ensureScript("Js/core/knowledge-base-adapter.js");
      }
      if (!window.KnowledgeToPatientEngine) {
        await this.ensureScript("Js/core/knowledge-to-patient-engine.js");
      }
      if (!window.ClinicalCaseGenerator) {
        await this.ensureScript("Js/core/clinical-case-generator.js");
      }

      if (!window.KnowledgeBaseAdapter || !window.KnowledgeToPatientEngine || !window.ClinicalCaseGenerator) {
        throw new Error("Componentes essenciais de geração não carregaram.");
      }

      try {
        const blueprintResponse = await fetch("knowledge_base/patient_generation/patient_generation_blueprint.json", { cache: "no-store" });
        if (!blueprintResponse.ok) throw new Error("HTTP " + blueprintResponse.status);
        this.generationBlueprint = await blueprintResponse.json();
      } catch (error) {
        this.generationBlueprint = {
          defaults_v0_1: {
            age_range: [20, 60],
            sex_values: ["feminino", "masculino"],
            initial_symptom_count: [1, 3]
          }
        };
        console.warn("Blueprint de geração indisponível; usando defaults mínimos:", error);
      }

      this.knowledgeAdapter = new window.KnowledgeBaseAdapter();
      await this.knowledgeAdapter.load();
      this.patientGenerator = new window.KnowledgeToPatientEngine({
        adapter: this.knowledgeAdapter,
        blueprint: this.generationBlueprint
      });

      // The clinical case generator is the authoritative creator of the playable
      // patient seed. The older patient generator remains available as a lower-level
      // compatibility layer, but it no longer defines the opening case.
      this.clinicalCaseGenerator = new window.ClinicalCaseGenerator({
        adapter: this.knowledgeAdapter,
        blueprint: this.generationBlueprint
      });

      onStatus?.(
        "gerador de pacientes",
        "ok",
        this.knowledgeAdapter.entities.length + " conceitos clínicos disponíveis para geração"
      );
    }

    async chooseSourceCases(count = 3, specialty = "todos") {
      await this.loadGenerationLayer();

      const candidates = this.knowledgeAdapter.candidatesForSpecialty(specialty);
      if (!candidates.length) {
        throw new Error(
          "A Knowledge Base não possui conceitos elegíveis para " +
          this.specialtyLabel(normalize(specialty || "todos").replace(/ /g, "_")) + "."
        );
      }

      const sourceCases = [];
      const used = new Set();

      while (sourceCases.length < Math.min(count, candidates.length)) {
        const entity = candidates[Math.floor(Math.random() * candidates.length)];
        if (!entity || used.has(entity.id)) continue;
        used.add(entity.id);

        const generated = this.patientGenerator.generate({
          conceptId: entity.id
        });

        generated.specialty = this.knowledgeAdapter.specialtyFor(entity);
        generated.specialty_label = this.specialtyLabel(generated.specialty);
        sourceCases.push(generated);
      }

      return sourceCases;
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

    async prepareFirst(onStatus) {
      await this.loadGenerationLayer(onStatus);
      const candidates = shuffle(this.knowledgeAdapter.getAllEntities());
      if (!candidates.length) throw new Error("Nenhum conceito clínico disponível na Knowledge Base.");

      let lastError = null;
      for (let i = 0; i < candidates.length; i += 1) {
        const entity = candidates[i];
        try {
          const sourceCase = await this.clinicalCaseGenerator.generate({
            conceptId: entity.id,
            research: false
          });
          const clinicalCase = this.buildLocalCase(sourceCase);
          this.validate(clinicalCase);
          if (clinicalCase.clinical_truth?.conversation_ready !== true) {
            throw new Error("verdade clínica conversacional incompleta");
          }

          // External/local reference enrichment is deliberately non-blocking.
          // The player gets a minimal case first; the evidence context can warm up
          // underneath the interaction.
          this.enrichCaseInBackground(clinicalCase);

          onStatus?.("seleção", "ok", "patologia selecionada e paciente sintético criado");
          return { sourceCase, card: this.cardData(clinicalCase, 0), case: clinicalCase };
        } catch (error) {
          lastError = error;
        }
      }

      throw new Error("Nenhum dos conceitos carregados conseguiu produzir um caso clínico mínimo. " +
        (lastError?.message || ""));
    }

    buildLocalCase(sourceCase) {
      if (!sourceCase) throw new Error("Gerador não retornou paciente clínico.");

      // The generator already returns the playable minimal clinical case.
      // Do not pass it through the legacy CaseBuilder: that layer was designed
      // to expand cases before the new knowledge-driven architecture existed.
      return clone(sourceCase);
    }

    enrichCaseInBackground(clinicalCase) {
      if (!clinicalCase || !window.CaseResearchEngine || !this.engine?.researchRules) return;

      Promise.resolve().then(async () => {
        try {
          const researcher = new window.CaseResearchEngine({
            config: this.engine.researchRules,
            provider: null
          });

          const concept = clinicalCase.hidden?.diagnosis
            || clinicalCase.primary_concept
            || clinicalCase.title;

          const evidence = await researcher.research({
            concept,
            primary_concept: concept,
            anchors: clinicalCase.reference_context?.external_sources?.map(item => item.title).filter(Boolean) || []
          });

          clinicalCase.reference_context = clinicalCase.reference_context || {};
          clinicalCase.reference_context.research = evidence || null;
          clinicalCase.reference_context.research_status = "completed";
        } catch (error) {
          clinicalCase.reference_context = clinicalCase.reference_context || {};
          clinicalCase.reference_context.research_status = "unavailable";
          clinicalCase.reference_context.research_error = error instanceof Error ? error.message : String(error);
        }
      });
    }

    async prepareRemaining(count, onStatus, usedConceptIds = []) {
      await this.loadGenerationLayer(onStatus);
      const blocked = new Set(usedConceptIds);
      const candidates = shuffle(this.knowledgeAdapter.candidatesForSpecialty("todos"))
        .filter(entity => !blocked.has(entity.id));

      const results = [];
      for (let i = 0; i < Math.min(count, candidates.length); i += 1) {
        const entity = candidates[i];
        const sourceCase = await this.clinicalCaseGenerator.generate({
          conceptId: entity.id,
          research: false
        });
        const clinicalCase = this.buildLocalCase(sourceCase);
        this.validate(clinicalCase);
        this.enrichCaseInBackground(clinicalCase);
        results.push({ sourceCase, card: this.cardData(clinicalCase, i + 1), case: clinicalCase });
        onStatus?.("caso " + (i + 2), "pronto", "gerado em segundo plano");
      }
      return results;
    }

    async prepare(count = 3, onStatus, specialty = "todos") {
      this.preparedCases = [];
      await this.loadMasterCatalog(onStatus);
      const normalizedSpecialty = normalize(specialty || "todos").replace(/ /g, "_");
      const sourceCases = await this.chooseSourceCases(count, normalizedSpecialty);

      const builtCases = [];
      for (let index = 0; index < sourceCases.length; index += 1) {
        builtCases.push(await this.researchAndBuild(sourceCases[index], index, onStatus));
      }

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
