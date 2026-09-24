(() => {
  "use strict";
  const normalize = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();

  class KnowledgeBaseAdapter {
    constructor(options = {}) {
      this.manifestPath = options.manifestPath || "knowledge_base/knowledge_sources_manifest.json";
      this.sources = [];
      this.modules = [];
      this.entities = [];
      this.loaded = false;
      this.sourceStatus = [];
    }

    async load() {
      if (this.loaded) return this;
      const manifestResponse = await fetch(this.manifestPath, {cache:"no-store"});
      if (!manifestResponse.ok) throw new Error("Manifesto da Knowledge Base indisponível: HTTP " + manifestResponse.status);
      const manifest = await manifestResponse.json();
      const paths = Array.isArray(manifest.include) ? manifest.include : [];
      this.sourceStatus = [];

      for (const rawPath of paths) {
        const cleanPath = String(rawPath).replace(/^knowledge_base\//,"");
        if (!/^DIAGNOSIS_CM\d+_/i.test(cleanPath)) continue;
        try {
          const response = await fetch("knowledge_base/" + cleanPath,{cache:"no-store"});
          if (!response.ok) {
            this.sourceStatus.push({ path: cleanPath, state: "error", error: "HTTP " + response.status, entities: 0 });
            continue;
          }
          const data = await response.json();
          if (!Array.isArray(data?.knowledge_entities)) {
            this.sourceStatus.push({ path: cleanPath, state: "error", error: "knowledge_entities ausente", entities: 0 });
            continue;
          }

          const module = {
            path: cleanPath,
            module: data.module || null,
            title: data.title || cleanPath,
            source_registry: data.source_registry || [],
            patient_generation: data.patient_generation || {},
            clinical_rules: Array.isArray(data.clinical_rules) ? data.clinical_rules : [],
            diagnostic_network: Array.isArray(data.diagnostic_network) ? data.diagnostic_network : [],
            summary_extraction: data.summary_extraction || null
          };
          this.modules.push(module);
          this.sources.push(cleanPath);
          this.sourceStatus.push({ path: cleanPath, state: "ok", error: null, entities: data.knowledge_entities.length });

          data.knowledge_entities.forEach(entity => {
            if (!entity || typeof entity !== "object" || !entity.id) return;
            this.entities.push({
              id: entity.id,
              canonical_name: entity.canonical_name || entity.name || entity.id,
              type: entity.type || "clinical_entity",
              features: Array.isArray(entity.features) ? entity.features : [],
              module: module.module,
              title: module.title,
              source_path: cleanPath,
              patient_generation: module.patient_generation,
              clinical_rules: module.clinical_rules,
              diagnostic_network: module.diagnostic_network,
              source_registry: module.source_registry
            });
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.sourceStatus.push({ path: cleanPath, state: "error", error: message, entities: 0 });
          console.warn("Falha ao adaptar Knowledge Base:",cleanPath,error);
        }
      }

      this.loaded = true;
      if (!this.entities.length) {
        throw new Error("Nenhuma Knowledge Base clínica pôde ser carregada.");
      }
      return this;
    }

    getSourceStatus(){ return this.sourceStatus.slice(); }
    getLoadedSourceCount(){ return this.sourceStatus.filter(s => s.state === "ok").length; }

    getAllEntities(){ return this.entities.slice(); }

    getById(id){
      const target=normalize(id);
      return this.entities.find(e=>normalize(e.id)===target || normalize(e.canonical_name)===target) || null;
    }

    specialtyFor(entity){
      const text=normalize([entity?.module,entity?.title,entity?.canonical_name,entity?.source_path].filter(Boolean).join(" "));
      if(/anemia|pancitopenia|hemostasia|linfonodo|esplenomegalia/.test(text)) return "hematologia";
      if(/arritmia|dor toracica|cardiovascular|cardiopatia/.test(text)) return "cardiologia";
      if(/pneumonia|dispneia|respiratoria|tosse/.test(text)) return "pneumologia";
      if(/epilepsia|neurologica|cefaleia|fraqueza/.test(text)) return "neurologia";
      if(/artrite|colagenose|vasculite|reumat/.test(text)) return "reumatologia";
      if(/diabetes|tireoide|suprarrenal|metabolica/.test(text)) return "endocrinologia";
      return "clinica_medica";
    }

    candidatesForSpecialty(specialty="todos"){
      const normalized=normalize(specialty).replace(/ /g,"_");
      return this.entities.filter(e=>normalized==="todos" || this.specialtyFor(e)===normalized);
    }

    presentationAnchors(entity){
      const anchors=[];
      const network=Array.isArray(entity?.diagnostic_network)?entity.diagnostic_network:[];
      network.forEach(item=>{
        if(!item || !Array.isArray(item.possibilities)) return;
        const matches=item.possibilities.some(v=>normalize(v)===normalize(entity.id)||normalize(v).includes(normalize(entity.canonical_name)));
        if(matches && item.axis) anchors.push(item.axis);
      });
      const presentations=entity?.patient_generation?.possible_presentations;
      if(Array.isArray(presentations)) anchors.push(...presentations);
      anchors.push(...(entity.features||[]));
      return [...new Set(anchors.map(v=>String(v).trim()).filter(Boolean))];
    }

    investigationAxes(entity){
      return Array.isArray(entity?.patient_generation?.axes) ? entity.patient_generation.axes.slice() : [];
    }

    toGenerationModel(entity){
      return {
        id:entity.id,
        canonical_name:entity.canonical_name,
        specialty:this.specialtyFor(entity),
        features:entity.features||[],
        presentation_anchors:this.presentationAnchors(entity),
        investigation_axes:this.investigationAxes(entity),
        patient_generation:entity.patient_generation||{},
        clinical_rules:entity.clinical_rules||[],
        diagnostic_network:entity.diagnostic_network||[],
        source_path:entity.source_path,
        source_registry:entity.source_registry||[]
      };
    }
  }
  global.KnowledgeBaseAdapter=KnowledgeBaseAdapter;
})();