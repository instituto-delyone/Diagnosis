(() => {
  "use strict";
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalize = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
  const pick = list => Array.isArray(list) && list.length ? list[Math.floor(Math.random()*list.length)] : null;
  const sample = (list,min,max) => {
    const source=Array.isArray(list)?[...list]:[]; const result=[];
    const target=Math.min(source.length,min+Math.floor(Math.random()*(Math.max(0,max-min+1))));
    while(source.length && result.length<target){ result.push(source.splice(Math.floor(Math.random()*source.length),1)[0]); }
    return result;
  };
  class KnowledgeToPatientEngine {
    constructor(options={}){ this.adapter=options.adapter||null; this.blueprint=options.blueprint||{}; }
    chooseAge(entity){
      const pg=entity?.patient_generation||{}; const range=pg.age_range||pg.age_ranges||this.blueprint.defaults_v0_1?.age_range||[20,60];
      if(Array.isArray(range)&&range.length>=2&&Number.isFinite(Number(range[0]))&&Number.isFinite(Number(range[1]))) return Math.round(Number(range[0])+Math.random()*(Number(range[1])-Number(range[0])));
      return 20+Math.floor(Math.random()*41);
    }
    chooseSex(entity){ const values=Array.isArray(entity?.patient_generation?.sex)?entity.patient_generation.sex:(this.blueprint.defaults_v0_1?.sex_values||["feminino","masculino"]); return pick(values)||"feminino"; }
    symptomCandidates(entity){
      const text=(this.adapter?.presentationAnchors(entity)||[]).join(" "); const normalized=normalize(text); const out=[];
      const patterns=[["dor","dor"],["dispneia","dispneia"],["falta de ar","dispneia"],["fadiga","fadiga"],["cansaco","cansaço"],["astenia","astenia"],["palidez","palidez"],["febre","febre"],["tosse","tosse"],["cefaleia","cefaleia"],["fraqueza","fraqueza"],["vomito","vômitos"],["vomitos","vômitos"],["nausea","náusea"],["diarreia","diarreia"],["edema","edema"],["sangramento","sangramento"],["sincope","síncope"],["convuls","crise convulsiva"],["palpit","palpitações"]];
      patterns.forEach(pair=>{if(normalized.includes(pair[0])) out.push(pair[1]);});
      if(!out.length){ const concept=normalize(entity.canonical_name||entity.id); if(concept.includes("anemia")) out.push("cansaço","palidez"); else if(concept.includes("pneumonia")) out.push("tosse","falta de ar"); else if(concept.includes("epileps")) out.push("crise convulsiva"); else out.push("queixa relacionada ao quadro clínico"); }
      return [...new Set(out)];
    }
    buildNarrative(patient,symptoms){
      const subject=patient.sex==="masculino"?"Homem":"Mulher"; const symptomText=symptoms.length>1?symptoms.slice(0,-1).join(", ")+" e "+symptoms.at(-1):(symptoms[0]||"queixa clínica");
      const duration=7+Math.floor(Math.random()*84);
      return {chief_complaint:symptomText,initial_narrative:subject+" de "+patient.age+" anos chega para avaliação por "+symptomText+", com início há aproximadamente "+duration+" dias.",onset:{type:duration<=14?"acute":"subacute",description:"há aproximadamente "+duration+" dias"}};
    }
    buildInvestigations(entity){
      const axes=this.adapter?.investigationAxes(entity)||[]; const normalized=axes.map(normalize); const entries=[];
      const add=(id,name,result,interpretation)=>{if(!entries.some(i=>normalize(i.exam)===normalize(name))) entries.push({id,exam:name,name,result,interpretation:interpretation||null,available:true,performed:false,source:"knowledge_base_generation"});};
      if(normalized.some(x=>x.includes("hemoglobina")||x.includes("vcm"))) add("hemograma","Hemograma","Resultado compatível com o padrão hematológico descrito pela Knowledge Base.","Interpretação reservada ao raciocínio clínico.");
      if(normalized.some(x=>x.includes("ferro"))) add("ferro_serico","Ferro sérico","Resultado compatível com o padrão de ferro descrito pela Knowledge Base.",null);
      if(normalized.some(x=>x.includes("ferritina"))) add("ferritina","Ferritina","Resultado compatível com o padrão de ferritina descrito pela Knowledge Base.",null);
      if(!entries.length) add("avaliacao_clinica","Avaliação clínica dirigida","Achados definidos pelo conhecimento local para o conceito selecionado.",null);
      return {catalog:entries,available:entries.map(item=>({id:item.id,exam:item.exam,name:item.name,result:clone(item.result),interpretation:item.interpretation,performed:false}))};
    }
    buildSource(entity,options={}){
      const model=this.adapter?.toGenerationModel(entity)||entity; const patient={age:this.chooseAge(model),sex:this.chooseSex(model)};
      const defaults=this.blueprint.defaults_v0_1?.initial_symptom_count||[1,3]; const symptoms=sample(this.symptomCandidates(model),defaults[0],defaults[1]);
      const narrative=this.buildNarrative(patient,symptoms); const investigations=this.buildInvestigations(model);
      return {
        id:"generated_"+Date.now()+"_"+Math.random().toString(36).slice(2,8), primary_concept:model.id, title:model.canonical_name, specialty:model.specialty, patient, opening:narrative,
        initial_state:{stability:"estável",severity:options.difficulty||"Simulação clínica"},
        history:{symptoms,risk_factors:[],past_medical_history:[],medications:[],allergies:[],family_history:[],social_history:[],onset:narrative.onset},
        physical_exam:{findings:symptoms,vital_signs:{}}, vitals:{}, investigations, management:{possible_actions:[]}, evolution:{temporal_evolution:[],consequences:{}},
        clinical_truth:{symptoms,signs:symptoms,risk_factors:[],differentials:model.diagnostic_network||[],generation_source:{source_path:model.source_path,method:"knowledge_to_patient_v0.1"}},
        hidden:{diagnosis:model.id,label:model.canonical_name,pathophysiology:{},differential:model.diagnostic_network||[]}, kb_source:model.source_path,kb_entity_id:model.id
      };
    }
    generate(options={}){
      if(!this.adapter) throw new Error("KnowledgeBaseAdapter não configurado.");
      const candidates=options.conceptId?[this.adapter.getById(options.conceptId)].filter(Boolean):this.adapter.candidatesForSpecialty(options.specialty||"todos");
      if(!candidates.length) throw new Error("Nenhum conceito clínico elegível para geração.");
      return this.buildSource(options.conceptId?candidates[0]:pick(candidates),options);
    }
  }
  global.KnowledgeToPatientEngine=KnowledgeToPatientEngine;
})();