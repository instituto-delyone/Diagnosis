(function (global) {
  "use strict";

  const DEFAULT_ENDPOINT = "https://diagnosis-gemini-proxy.dr-delyone.workers.dev/api/gemini/research";

  class DiagnosysGeminiProvider {
    constructor(options) {
      options = options || {};
      this.endpoint = options.endpoint || DEFAULT_ENDPOINT;
    }

    async research(payload) {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload || {})
      });

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); }
      catch (error) { throw new Error("Resposta inválida do Worker Gemini (HTTP " + response.status + ")."); }

      if (!response.ok || !data?.ok) {
        const detail = data?.details || data?.message || data?.error || ("HTTP " + response.status);
        throw new Error(String(detail));
      }
      return data;
    }
  }

  global.DiagnosysGeminiProvider = DiagnosysGeminiProvider;
})(window);