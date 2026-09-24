(() => {
  "use strict";

  /*
   * Diagnosys — Clinical Case Generator v1
   *
   * Responsibility:
   *   Knowledge Base JSON -> plausible minimal synthetic patient -> playable case seed
   *
   * This module deliberately does NOT depend on Gemini.
   * External research is optional and non-blocking.
   */

  const normalize = value => String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  const pick = list => {
    const values = Array.isArray(list) ? list.filter(Boolean) : [];
    return values.length ? values[Math.floor(Math.random() * values.length)] : null;
  };

  const unique = list => [...new Set((Array.isArray(list) ? list : []).map(v => String(v).trim()).filter(Boolean))];

  const initials = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const count = 3 + Math.floor(Math.random() * 2);
    let value = "";
    for (let i = 0; i < count; i += 1) value += letters[Math.floor(Math.random() * letters.length)];
    return value;
  };

  const isDiseaseName = value => {
    const n = normalize(value);
    if (!n) return false;
    if (/^(hyperbilirubinemia|sindrome|syndrome|hepatocelular|colestatic|mixed|bilirrubin|metabolismo|obstrucao|ictericia|jaundice)/.test(n)) return false;
    return /hepatite|cirrose|doenca|cancer|carcinoma|colangite|colangio|colelit|pancreatite|wilson|gilbert|crigler|dubin|rotor|ebv|cmv|hsv|autoimune|esteato|steato|sickle|anemia|trombose|infeccao|hepatica/.test(n)
      || n.split(" ").length >= 2;
  };

  const label = value => String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, m => m.toUpperCase());

  class ClinicalCaseGenerator {
    constructor(options = {}) {
      this.adapter = options.adapter || null;
      this.blueprint = options.blueprint || {};
      this.referencePaths = options.referencePaths || [
        "knowledge_base/reference_ranges.json",
        "knowledge_base/pcdt_catalog.json",
        "knowledge_base/msd_navigation_catalog.json"
      ];
      this.researcher = options.researcher || null;
    }

    async loadModule(entity) {
      if (!entity?.source_path) throw new Error("Entidade sem source_path.");
      const response = await fetch("knowledge_base/" + entity.source_path, { cache: "no-store" });
      if (!response.ok) throw new Error("Falha ao reler " + entity.source_path + ": HTTP " + response.status);
      return response.json();
    }

    extractDiseaseCandidates(module, entity) {
      const candidates = [];

      const add = (value, origin = "knowledge") => {
        if (!value) return;
        if (Array.isArray(value)) {
          value.forEach(item => add(item, origin));
          return;
        }
        if (typeof value === "object") {
          Object.entries(value).forEach(([key, item]) => {
            if (/etiolog|disease|diseases|condition|caus|hepatocellular|associated_domains/i.test(key)) {
              add(item, origin + ":" + key);
            }
          });
          return;
        }
        const text = String(value).trim();
        if (isDiseaseName(text)) candidates.push({ name: text, origin });
      };

      (module?.knowledge_entities || []).forEach(item => {
        const type = normalize(item?.type);
        if (/disease|condition|etiolog/.test(type)) {
          add(item?.canonical_name || item?.name || item?.id, "knowledge_entity");
        }
        add(item?.associated_domains, "associated_domain");
        add(item?.causes, "causal_space");
      });

      const extraction = module?.embedded_reference_extraction?.etiologic_classes;
      if (extraction) {
        Object.entries(extraction).forEach(([className, classData]) => {
          if (classData && typeof classData === "object") {
            Object.entries(classData).forEach(([route, values]) => add(values, className + ":" + route));
          }
        });
      }

      const semantic = module?.summary_extraction?.explicit_compact_content;
      add(semantic?.hepatitis_notes, "summary");

      const result = [];
      const seen = new Set();
      for (const item of candidates) {
        const key = normalize(item.name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(item);
      }
      return result;
    }

    choosePathology(module, entity) {
      const candidates = this.extractDiseaseCandidates(module, entity);

      // Prefer disease-level candidates over broad mechanisms/syndromes.
      const diseaseLevel = candidates.filter(item =>
        /hepatite|cirrose|doenca|cancer|carcinoma|wilson|gilbert|crigler|dubin|rotor|cmv|ebv|hsv/.test(normalize(item.name))
      );

      const pool = diseaseLevel.length ? diseaseLevel : candidates;
      const selected = pick(pool);

      if (!selected) {
        return {
          name: entity.canonical_name || entity.id,
          origin: "knowledge_entity_fallback",
          candidates: []
        };
      }

      return { ...selected, candidates: pool.map(item => item.name) };
    }

    epidemiologyFor(module, pathology) {
      const sources = [
        module?.epidemiology,
        module?.patient_generation?.epidemiology,
        module?.knowledge_entities?.find(e => normalize(e.canonical_name || e.name || e.id) === normalize(pathology.name))?.epidemiology
      ].filter(Boolean);

      for (const source of sources) {
        if (Array.isArray(source?.age_range) && source.age_range.length >= 2) {
          const min = Number(source.age_range[0]);
          const max = Number(source.age_range[1]);
          if (Number.isFinite(min) && Number.isFinite(max)) {
            return { age: Math.round(min + Math.random() * Math.max(0, max - min)), source: "knowledge_base" };
          }
        }
        if (Number.isFinite(Number(source?.typical_age))) {
          return { age: Number(source.typical_age), source: "knowledge_base" };
        }
      }

      // The source may not provide a disease-specific incidence peak.
      // In that situation use the broad generation axis instead of fabricating an
      // epidemiological fact.
      const axes = module?.patient_generation?.axes?.age || [];
      if (axes.includes("child")) return { age: 8, source: "generation_axis" };
      if (axes.includes("older adult")) return { age: 68, source: "generation_axis" };
      if (axes.includes("neonate")) return { age: 0, source: "generation_axis" };
      return { age: 44 + Math.floor(Math.random() * 17), source: "adult_default_when_peak_unavailable" };
    }

    sexFor(module, pathology) {
      const distributions = [
        module?.epidemiology?.sex_distribution,
        module?.patient_generation?.sex_distribution
      ].filter(Boolean);

      const value = pick(distributions);
      if (value === "female" || value === "male") return value === "female" ? "feminino" : "masculino";
      return pick(["feminino", "masculino"]);
    }

    complaintFor(pathology, module) {
      const n = normalize(pathology.name);

      if (/hepatite|hepatica|cirrose|wilson|cmv|ebv|hsv/.test(n)) {
        return pick([
          "Estou ficando amarelo.",
          "Minha pele e meus olhos estão amarelos.",
          "Notei que estou amarelado."
        ]);
      }

      if (/colang|colelit|pancreat|obstrucao/.test(n)) {
        return pick([
          "Estou amarelo e com dor do lado direito da barriga.",
          "Percebi que fiquei amarelo e minha urina escureceu."
        ]);
      }

      return pick(module?.patient_generation?.axes?.symptom_profile) ||
        "Estou com os olhos amarelados.";
    }

    riskFactorFor(pathology, module) {
      const n = normalize(pathology.name);

      const explicit = [
        module?.risk_factors,
        module?.knowledge_entities?.find(e => normalize(e.canonical_name || e.name || e.id) === n)?.risk_factors
      ].flat().filter(Boolean);

      if (explicit.length) return String(pick(explicit));

      if (/hepatite b|hepatitis b/.test(n)) return "exposição epidemiológica compatível com hepatite B";
      if (/hepatite c|hepatitis c/.test(n)) return "exposição epidemiológica compatível com hepatite C";
      if (/hepatite|ebv|cmv|hsv/.test(n)) return "exposição infecciosa compatível com a etiologia";
      if (/alcool|alcohol/.test(n)) return "uso crônico de álcool";
      if (/autoimune/.test(n)) return "contexto pessoal compatível com doença autoimune";
      if (/wilson/.test(n)) return "história familiar de doença hepática hereditária";
      if (/cirrose/.test(n)) return "doença hepática crônica prévia";

      return null;
    }

    habitFor(pathology) {
      const n = normalize(pathology.name);
      if (/alcool|alcohol|hepatite alcoolica/.test(n)) return "consumo crônico de álcool";
      return null;
    }

    dysfunctionFor(pathology) {
      const n = normalize(pathology.name);
      if (/hepatite alcoolica|cirrose/.test(n)) return pick([
        "Refere redução recente da tolerância ao álcool.",
        "Refere dificuldade para manter as atividades habituais por cansaço."
      ]);
      if (/obstrucao|colang|colelit/.test(n)) return "Refere que a alimentação piora o desconforto abdominal.";
      return null;
    }

    buildReferenceContext(module, pathology) {
      const registry = Array.isArray(module?.source_registry) ? module.source_registry : [];
      const relevant = registry.filter(source => {
        const text = normalize([
          source?.title, source?.role, source?.matched_by, source?.url
        ].filter(Boolean).join(" "));
        const disease = normalize(pathology.name);
        return !disease || text.includes(disease.split(" ")[0]) ||
          /hepat|bilirubin|hyperbilirubinemia|pcdt|manual|statpearls|msd/.test(text);
      });

      return {
        ready: true,
        local_sources: unique(this.referencePaths),
        external_sources: relevant.map(source => ({
          id: source.id || null,
          title: source.title || null,
          publisher: source.publisher || null,
          url: source.url || null,
          role: source.role || null
        })),
        selected_pathology: pathology.name,
        research_status: this.researcher ? "optional_research_available" : "local_reference_context_only"
      };
    }

    async generate(options = {}) {
      if (!this.adapter) throw new Error("ClinicalCaseGenerator sem KnowledgeBaseAdapter.");

      const entity = options.conceptId
        ? this.adapter.getById(options.conceptId)
        : pick(this.adapter.getAllEntities());

      if (!entity) throw new Error("Nenhum conceito clínico disponível.");

      const module = await this.loadModule(entity);
      const pathology = this.choosePathology(module, entity);
      const epidemiology = this.epidemiologyFor(module, pathology);

      const patient = {
        initials: initials(),
        age: epidemiology.age,
        sex: this.sexFor(module, pathology),
        identity_is_synthetic: true
      };

      const riskFactor = this.riskFactorFor(pathology, module);
      const habit = this.habitFor(pathology);
      const dysfunction = this.dysfunctionFor(pathology);

      const symptoms = [this.complaintFor(pathology, module)];

      const history = {
        risk_factors: riskFactor ? [riskFactor] : [],
        habits: habit ? [habit] : [],
        dysfunctions: dysfunction ? [dysfunction] : [],
        symptoms,
        duration: pick(["há alguns dias", "há cerca de uma semana", "há algumas semanas"])
      };

      const narrativeParts = [
        patient.initials + ", " + patient.age + " anos, " + (patient.sex === "feminino" ? "mulher" : "homem") + ".",
        symptoms[0]
      ];

      if (riskFactor) narrativeParts.push("Relata " + riskFactor + ".");
      if (dysfunction) narrativeParts.push(dysfunction);

      const sourceTruth = {
        diagnosis: pathology.name,
        pathology_source: pathology.origin,
        pathology_candidates: pathology.candidates || [],
        module: module.model_metadata?.module || module.module || entity.module || null,
        source_path: entity.source_path,
        clinical_basis: {
          patient_generation: clone(module.patient_generation || {}),
          clinical_rules: clone(module.clinical_rules || []),
          diagnostic_network: clone(module.diagnostic_network || []),
          summary_extraction: clone(module.summary_extraction || null),
          embedded_reference_extraction: clone(module.embedded_reference_extraction || null)
        }
      };

      const generated = {
        id: "synthetic_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        case_id: "dx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        primary_concept: pathology.name,
        title: "Paciente sintético — " + pathology.name,
        difficulty: options.difficulty || "Simulação clínica",
        patient,
        opening: {
          chief_complaint: symptoms[0],
          initial_narrative: narrativeParts.join(" ")
        },
        presentation: {
          chief_complaint: symptoms[0],
          initial_narrative: narrativeParts.join(" "),
          vitals: {}
        },
        initial_state: {
          stability: "estável",
          severity: "não classificada",
          care_mode: options.careMode || "diagnostic"
        },
        history,
        physical_exam: {
          findings: [],
          vitals: {}
        },
        investigations: {
          catalog: [],
          available: []
        },
        management: {
          possible_actions: []
        },
        evolution: {
          temporal_evolution: [],
          consequences: {}
        },
        clinical_truth: {
          conversation_ready: true,
          diagnosis: pathology.name,
          symptoms,
          risk_factors: history.risk_factors,
          hidden_context: sourceTruth
        },
        hidden: {
          diagnosis: pathology.name,
          label: pathology.name,
          target: pathology.name,
          pathology_candidates: pathology.candidates || [],
          source_truth: sourceTruth
        },
        reference_context: this.buildReferenceContext(module, pathology),
        generation_meta: {
          generator: "ClinicalCaseGenerator",
          version: "1.0",
          synthetic_patient: true,
          epidemiology_source: epidemiology.source,
          source_path: entity.source_path,
          source_entity_id: entity.id
        }
      };

      if (this.researcher && options.research === true) {
        try {
          generated.reference_context.research = await this.researcher.research({
            concept: pathology.name,
            primary_concept: pathology.name,
            anchors: [entity.canonical_name || entity.id]
          });
          generated.reference_context.research_status = "completed";
        } catch (error) {
          generated.reference_context.research_status = "failed";
          generated.reference_context.research_error = error.message || String(error);
        }
      }

      return generated;
    }
  }

  window.ClinicalCaseGenerator = ClinicalCaseGenerator;
})();