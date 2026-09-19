(function (global) {
  "use strict";

  const DEFAULT_ENDPOINT = "https://diagnosis-gemini-proxy.dr-delyone.workers.dev/api/gemini/research";
  const DEFAULT_TIMEOUT_MS = 30000;

  function isValidResult(data) {
    return Boolean(
      data &&
      data.ok === true &&
      data.result &&
      typeof data.result === "object" &&
      typeof data.result.concept === "string" &&
      Array.isArray(data.result.sections)
    );
  }

  class DiagnosysGeminiProvider {
    constructor(options) {
      options = options || {};
      this.endpoint = options.endpoint || DEFAULT_ENDPOINT;
      this.timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
    }

    async research(payload) {
      const controller = new AbortController();
      const timer = global.setTimeout(() => controller.abort(), this.timeoutMs);

      let response;
      let text;

      try {
        response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(payload || {}),
          signal: controller.signal
        });
        text = await response.text();
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new Error("Tempo esgotado ao consultar o Worker Gemini.");
        }
        throw new Error("Não foi possível conectar ao Worker Gemini: " + (error?.message || error));
      } finally {
        global.clearTimeout(timer);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (error) {
        throw new Error(
          "Resposta inválida do Worker Gemini (HTTP " +
          response.status +
          ")."
        );
      }

      if (!response.ok || data?.ok !== true) {
        const detail =
          data?.details ||
          data?.message ||
          data?.error ||
          ("HTTP " + response.status);
        throw new Error(String(detail));
      }

      if (!isValidResult(data)) {
        throw new Error("Worker Gemini respondeu sem o contrato JSON esperado.");
      }

      return data;
    }
  }

  global.DiagnosysGeminiProvider = DiagnosysGeminiProvider;
})(window);
