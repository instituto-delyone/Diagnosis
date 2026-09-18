(function (global) {
  "use strict";

  class CombinedClinicalResearchProvider {
    constructor(options) {
      options = options || {};
      this.pcdt = options.pcdt || global.PCDTCatalogProvider || null;
      this.msd = options.msd || global.MSDCatalogProvider || null;
    }

    async search(query, context) {
      context = context || {};
      if (context.source === "ministerio_saude") {
        return this.pcdt?.search(query, context) || null;
      }
      if (context.source === "msd_manuals") {
        return this.msd?.search(query, context) || null;
      }
      return null;
    }
  }

  global.CombinedClinicalResearchProvider = CombinedClinicalResearchProvider;
  global.DiagnosysResearchProvider = new CombinedClinicalResearchProvider();
})(window);
