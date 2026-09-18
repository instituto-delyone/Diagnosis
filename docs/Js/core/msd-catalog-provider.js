(function (global) {
  "use strict";

  class MSDCatalogProvider {
    constructor(options) {
      options = options || {};
      this.entries = options.entries || [
        {"section":"Cardiologia","name":"Fibrilação atrial","url":"https://www.msdmanuals.com/professional/cardiovascular-disorders/arrhythmias-and-conduction-disorders/specific-cardiac-arrhythmias/atrial-fibrillation"},
        {"section":"Cardiologia","name":"Flutter atrial","url":"https://www.msdmanuals.com/professional/cardiovascular-disorders/arrhythmias-and-conduction-disorders/specific-cardiac-arrhythmias/atrial-flutter"},
        {"section":"Cardiologia","name":"Taquicardia ventricular","url":"https://www.msdmanuals.com/professional/cardiovascular-disorders/arrhythmias-and-conduction-disorders/specific-cardiac-arrhythmias/ventricular-tachycardia"},
        {"section":"Cardiologia","name":"Fibrilação ventricular","url":"https://www.msdmanuals.com/professional/cardiovascular-disorders/arrhythmias-and-conduction-disorders/specific-cardiac-arrhythmias/ventricular-fibrillation"},
        {"section":"Cardiologia","name":"Bloqueio atrioventricular","url":"https://www.msdmanuals.com/professional/cardiovascular-disorders/arrhythmias-and-conduction-disorders/specific-cardiac-arrhythmias/atrioventricular-block"},
        {"section":"Cardiologia","name":"Síndrome de Wolff-Parkinson-White","url":"https://www.msdmanuals.com/professional/cardiovascular-disorders/arrhythmias-and-conduction-disorders/specific-cardiac-arrhythmias/wolff-parkinson-white-syndrome"},
        {"section":"Cardiologia","name":"Cardiomiopatia hipertrófica","url":"https://www.msdmanuals.com/professional/cardiovascular-disorders/cardiomyopathies/overview-of-cardiomyopathies"},
        {"section":"Cardiologia","name":"Aterosclerose","url":"https://www.msdmanuals.com/professional/cardiovascular-disorders/arteriosclerosis/atherosclerosis"},
        {"section":"Endocrinologia","name":"Diabetes mellitus","url":"https://www.msdmanuals.com/professional/endocrine-and-metabolic-disorders/diabetes-mellitus-and-hypoglycemia/overview-of-diabetes-mellitus"},
        {"section":"Endocrinologia","name":"Diabetes mellitus tipo 2","url":"https://www.msdmanuals.com/professional/endocrine-and-metabolic-disorders/diabetes-mellitus-and-hypoglycemia/type-2-diabetes-mellitus"},
        {"section":"Endocrinologia","name":"Insuficiência adrenal primária (doença de Addison)","url":"https://www.msdmanuals.com/professional/endocrine-and-metabolic-disorders/adrenal-disorders/primary-adrenal-insufficiency-addison-disease"},
        {"section":"Endocrinologia","name":"Distúrbios endócrinos — visão geral","url":"https://www.msdmanuals.com/professional/endocrine-and-metabolic-disorders/principles-of-endocrinology/overview-of-endocrine-disorders"},
        {"section":"Gastroenterologia","name":"Avaliação do paciente gastrointestinal","url":"https://www.msdmanuals.com/professional/gastrointestinal-disorders/approach-to-the-gastrointestinal-patient/evaluation-of-the-gastrointestinal-patient"},
        {"section":"Gastroenterologia","name":"Sintomas gastrointestinais","url":"https://www.msdmanuals.com/professional/gastrointestinal-disorders/symptoms-of-gastrointestinal-disorders/overview-of-gastrointestinal-symptoms"},
        {"section":"Hematologia","name":"Hematologia — seção profissional","url":"https://www.msdmanuals.com/professional/hematology"},
        {"section":"Doença infecciosa","name":"Doenças infecciosas — seção profissional","url":"https://www.msdmanuals.com/professional/infectious-diseases"},
        {"section":"Nefrologia","name":"Avaliação do paciente com problemas renais","url":"https://www.msdmanuals.com/professional/nephrology/approach-to-the-patient-with-renal-issues/evaluation-of-the-patient-with-renal-issues"},
        {"section":"Neurologia","name":"Neurologia — seção profissional","url":"https://www.msdmanuals.com/professional/neurologic-disorders"},
        {"section":"Pneumologia","name":"Avaliação do paciente com problemas pulmonares","url":"https://www.msdmanuals.com/professional/pulmonary-disorders/approach-to-the-pulmonary-patient/evaluation-of-the-patient-with-pulmonary-issues"},
        {"section":"Pneumologia","name":"Testes de função pulmonar","url":"https://www.msdmanuals.com/professional/pulmonary-disorders/tests-of-pulmonary-function-pft/airflow-lung-volumes-and-flow-volume-loop"},
        {"section":"Reumatologia e ortopedia","name":"Reumatologia e ortopedia — seção profissional","url":"https://www.msdmanuals.com/professional/musculoskeletal-and-connective-tissue-disorders"},
        {"section":"Alergia e imunologia","name":"Anafilaxia","url":"https://www.msdmanuals.com/professional/immunology-allergic-disorders/allergic-autoimmune-and-other-hypersensitivity-disorders/anaphylaxis"},
        {"section":"Alergia e imunologia","name":"Hipersensibilidade a medicamentos","url":"https://www.msdmanuals.com/professional/immunology-allergic-disorders/allergic-autoimmune-and-other-hypersensitivity-disorders/drug-hypersensitivity"},
        {"section":"Alergia e imunologia","name":"Alergia alimentar","url":"https://www.msdmanuals.com/professional/immunology-allergic-disorders/allergic-autoimmune-and-other-hypersensitivity-disorders/food-allergy"},
        {"section":"Alergia e imunologia","name":"Doenças autoimunes","url":"https://www.msdmanuals.com/professional/immunology-allergic-disorders/allergic-autoimmune-and-other-hypersensitivity-disorders/autoimmune-disorders"},
        {"section":"Dermatologia","name":"Avaliação do paciente dermatológico","url":"https://www.msdmanuals.com/professional/dermatologic-disorders/approach-to-the-dermatologic-patient/evaluation-of-the-dermatologic-patient"},
        {"section":"Dermatologia","name":"Descrição das lesões cutâneas","url":"https://www.msdmanuals.com/professional/dermatologic-disorders/approach-to-the-dermatologic-patient/description-of-skin-lesions"},
        {"section":"Dermatologia","name":"Testes diagnósticos para doenças cutâneas","url":"https://www.msdmanuals.com/professional/dermatologic-disorders/approach-to-the-dermatologic-patient/diagnostic-tests-for-skin-disorders"}
      ];
    }

    normalize(value) {
      return String(value || "").toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ").trim();
    }

    score(query, entry) {
      const q = this.normalize(query), name = this.normalize(entry.name);
      if (!q || !name) return 0;
      if (q.includes(name)) return 100;
      let score = 0;
      const tokens = q.split(" ").filter(token => token.length >= 4);
      const names = new Set(name.split(" "));
      tokens.forEach(token => { if (names.has(token)) score += 8; else if (name.includes(token)) score += 3; });
      return score;
    }

    async search(query, context) {
      if ((context || {}).source !== "msd_manuals") return null;
      const ranked = this.entries.map(entry => ({entry, score:this.score(query, entry)}))
        .filter(item => item.score > 0)
        .sort((a,b) => b.score-a.score || a.entry.name.localeCompare(b.entry.name,"pt-BR"))
        .slice(0,5);
      if (!ranked.length) return null;
      return {
        type:"msd_catalog_match",
        source:"Manual MSD — Profissionais",
        source_index_url:"https://www.msdmanuals.com/professional/",
        query,
        matches:ranked.map(item => ({name:item.entry.name,section:item.entry.section,score:item.score,url:item.entry.url}))
      };
    }
  }

  global.MSDCatalogProvider = MSDCatalogProvider;
})(window);
