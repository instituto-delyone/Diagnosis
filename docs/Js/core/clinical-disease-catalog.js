(function (global) {
  "use strict";

  /*
   * ClinicalDiseaseCatalog
   *
   * Uses the existing Diagnosys master catalog as the concept registry and
   * exposes only broadly useful clinical conditions to the case generator.
   * Eligibility is deliberately conservative: rare/highly specialized
   * entities and protocol/procedure-only entries are excluded.
   *
   * A catalog entry is NOT case truth. A complete Clinical Case Model must
   * still be built and validated before presentation.
   */
  class ClinicalDiseaseCatalog {
    constructor(options) {
      options = options || {};
      this.path = options.path || "knowledge_base/diagnosys_catalogo_mestre_doencas.json";
      this.catalog = null;
      this.loading = null;
    }

    normalize(value) {
      return String(value || "").toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ").trim();
    }

    excluded(name) {
      const n = this.normalize(name);
      const rare = [
        "amiloidose","transtirretina","biotinidase","fabry","gaucher","niemann","pompe",
        "mucopolissacaridose","homocistinuria","epidermolise bolhosa","atrofia muscular espinhal",
        "angioedema deficiencia c1","porfiria","hemoglobinuria paroxistica noturna",
        "ictioses hereditarias","osteogenese imperfeita","fenilcetonuria","doenca de wilson",
        "doenca de paget","fibrose cistica","linfangioleiomiomatose","mesotelioma",
        "pseudomixoma","esclerose lateral amiotrofica","esclerose sistemica",
        "espondilite ancilosante","miopatias inflamatorias","mieloma multiplo","leucemia",
        "linfoma","tumor cerebral","tumor do estroma","carcinoma","adenocarcinoma",
        "distrator osteogenico","cross linking","nirsevimabe","palivizumabe",
        "blinatumomabe","imunotolerancia","emicizumabe","imunossupressao",
        "deficiencia intelectual","sindrome de turner","sindrome mielodisplasica",
        "sindrome nefrotica","hipoparatireoidismo","hiperprolactinemia",
        "hiperplasia adrenal congenita","diabetes insipido"
      ];
      const nonDisease = [
        "assistencia ao parto","atencao a gestante","atencao integral","linha de cuidado",
        "prevencao da transmissao","profilaxia","pessoas com deficiencia","utilizacao de ",
        "diagnostico e tratamento de intoxicacoes","marca passos","talidomida",
        "estrategias para atenuar","comportamento agressivo","manejo da infeccao pelo hiv",
        "imunodeficiencia primaria","inducao de imunotolerancia","hemofilia a",
        "hidroxocobalamina","isotretinoina"
      ];
      return rare.concat(nonDisease).some(term => n.includes(term));
    }

    async load() {
      if (this.catalog) return this.catalog;
      if (this.loading) return this.loading;
      this.loading = fetch(this.path, {cache:"no-store"})
        .then(response => {
          if (!response.ok) throw new Error("Catálogo clínico HTTP " + response.status);
          return response.json();
        })
        .then(data => { this.catalog = data || {entries:[]}; return this.catalog; })
        .finally(() => { this.loading = null; });
      return this.loading;
    }

    async getPlayableEntries() {
      const catalog = await this.load();
      return (Array.isArray(catalog.entries) ? catalog.entries : [])
        .filter(entry => entry && entry.name && !this.excluded(entry.name));
    }

    async isEligible(name) {
      const entries = await this.getPlayableEntries();
      const n = this.normalize(name);
      return entries.some(entry => this.normalize(entry.name) === n);
    }

    async find(query) {
      const q = this.normalize(query);
      if (!q) return [];
      const entries = await this.getPlayableEntries();
      return entries.map(entry => {
        const name = this.normalize(entry.name);
        let score = name === q ? 100 : (name.includes(q) || q.includes(name) ? 80 : 0);
        q.split(" ").filter(Boolean).forEach(token => { if (name.includes(token)) score += 5; });
        return {entry,score};
      }).filter(item => item.score > 0)
        .sort((a,b) => b.score-a.score || a.entry.name.localeCompare(b.entry.name,"pt-BR"))
        .slice(0,10).map(item => item.entry);
    }
  }

  global.ClinicalDiseaseCatalog = ClinicalDiseaseCatalog;
})(window);
