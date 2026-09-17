(function (global) {
  "use strict";

  /*
   * Diagnosys PCDT Research Provider
   *
   * Uses the official Ministry of Health A-Z catalogue already stored in
   * docs/knowledge_base/pcdt_catalog.json. It does not invent guideline
   * content: it resolves a clinical concept to the official catalogue entry
   * and returns the official navigation URL plus provenance.
   *
   * A future backend/proxy can be plugged in here to fetch the actual
   * guideline/PDF text without changing CaseResearchEngine.
   */
  class PCDTCatalogProvider {
    constructor(options) {
      options = options || {};
      this.catalogUrl = options.catalogUrl || "knowledge_base/pcdt_catalog.json";
      this.catalog = null;
      this.loading = null;
    }

    normalize(value) {
      return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    async load() {
      if (this.catalog) return this.catalog;
      if (this.loading) return this.loading;

      this.loading = fetch(this.catalogUrl, { cache: "no-store" })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("PCDT catalog HTTP " + response.status);
          }
          return response.json();
        })
        .then(data => {
          this.catalog = data || { entries: [] };
          return this.catalog;
        })
        .finally(() => {
          this.loading = null;
        });

      return this.loading;
    }

    score(query, entry) {
      const q = this.normalize(query);
      const name = this.normalize(entry.name);
      if (!q || !name) return 0;

      if (q.includes(name)) return 100;

      const tokens = q.split(" ").filter(token => token.length >= 4);
      const nameTokens = new Set(name.split(" "));
      let score = 0;

      tokens.forEach(token => {
        if (nameTokens.has(token)) score += 8;
        else if (name.includes(token)) score += 3;
      });

      return score;
    }

    async search(query, context) {
      context = context || {};
      if (context.source !== "ministerio_saude") return null;

      const catalog = await this.load();
      const entries = Array.isArray(catalog.entries) ? catalog.entries : [];

      const ranked = entries
        .map(entry => ({ entry: entry, score: this.score(query, entry) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, "pt-BR"))
        .slice(0, 5);

      if (!ranked.length) return null;

      return {
        type: "pcdt_catalog_match",
        source: catalog.source || "Ministério da Saúde — Protocolos Clínicos e Diretrizes Terapêuticas",
        source_index_url: catalog.source_index_url,
        query: query,
        matches: ranked.map(item => ({
          name: item.entry.name,
          letter: item.entry.letter,
          score: item.score,
          guideline_entry_url: item.entry.guideline_entry_url,
          catalog_page_url: item.entry.catalog_page_url
        }))
      };
    }
  }

  global.PCDTCatalogProvider = PCDTCatalogProvider;
  global.DiagnosysResearchProvider = global.DiagnosysResearchProvider ||
    new PCDTCatalogProvider();
})(window);
