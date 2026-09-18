(function (global) {
  "use strict";

  const escapeHTML = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const normalize = value => String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  function asText(value) {
    if (Array.isArray(value)) return value.filter(Boolean).join(" ");
    if (value && typeof value === "object") {
      return Object.values(value).filter(Boolean).join(" ");
    }
    return String(value || "");
  }

  function firstMeaningful(obj, keys) {
    for (const key of keys) {
      if (obj && obj[key]) return asText(obj[key]);
    }
    return "";
  }

  class ScientificBase {
    constructor(engine) {
      this.engine = engine;
      this.root = document.getElementById("scientificBase");
    }

    open() {
      if (!this.root) return;
      this.render();
      this.root.classList.remove("scientific-base-hidden");
      document.body.classList.add("scientific-base-open");
    }

    close() {
      this.root?.classList.add("scientific-base-hidden");
      document.body.classList.remove("scientific-base-open");
    }

    render() {
      const c = this.engine.currentCase || {};
      const hidden = c.hidden || {};
      const diagnosis = hidden.label || hidden.diagnosis || c.title || "condição clínica";
      const educational = c.educational || {};
      const history = c.history || {};
      const physical = c.physical_exam || {};
      const investigations = c.investigations || {};
      const management = Array.isArray(c.management) ? c.management : [];

      const pathophysiology =
        firstMeaningful(educational, ["pathophysiology", "fisiopatologia", "physiopathology"]) ||
        firstMeaningful(c, ["pathophysiology", "fisiopatologia"]) ||
        "A fisiopatologia específica desta condição deve ser consultada nas fontes científicas indicadas abaixo. O jogo não inventa conteúdo quando a base local não o fornece.";

      const propedeutics =
        firstMeaningful(educational, ["propedeutics", "propedeutica", "propedêutica", "diagnosis", "diagnostico"]) ||
        [
          history.symptoms?.length ? "Sintomas: " + history.symptoms.join(", ") + "." : "",
          physical.findings?.length ? "Achados ao exame físico: " + physical.findings.join(", ") + "." : "",
          Array.isArray(investigations.available)
            ? "Investigações disponíveis no caso: " + investigations.available.map(x => x.exam || x.name).filter(Boolean).join(", ") + "."
            : ""
        ].filter(Boolean).join(" ") ||
        "A propedêutica deste caso não está descrita localmente.";

      const treatment =
        firstMeaningful(educational, ["treatment", "tratamento", "management", "manejo"]) ||
        (management.length
          ? "Condutas previstas no caso: " + management.join("; ") + "."
          : "O tratamento específico não está descrito na base local deste caso. Consulte as fontes oficiais.");

      const complications =
        firstMeaningful(educational, ["complications", "complicacoes", "complicações", "prognosis", "prognostico"]) ||
        asText(c.consequences) ||
        "As complicações/prognóstico específicos não estão disponíveis na base local.";

      const evidence = this.engine.research?.evidence || [];
      const evidenceItems = evidence.slice(0, 8).map(item => {
        const result = item.result || {};
        const matches = Array.isArray(result.matches) ? result.matches : [];
        const names = matches.map(x => x.name).filter(Boolean);
        const excerpt = result.excerpt || result.abstract || result.summary || "";
        return (
          '<div class="science-evidence-item">' +
            '<strong>' + escapeHTML(item.source_name || item.source_id || "Fonte") + '</strong>' +
            '<span>' + escapeHTML(excerpt || names.join(" · ") || item.query || "Resultado localizado.") + '</span>' +
          '</div>'
        );
      }).join("");

      this.root.innerHTML =
        '<div class="scientific-base-card">' +
          '<div class="scientific-base-header">' +
            '<div>' +
              '<div class="scientific-base-kicker">BASE CIENTÍFICA</div>' +
              '<h2>' + escapeHTML(diagnosis) + '</h2>' +
              '<p>Material de estudo liberado após a decisão de consultar a base. O conteúdo é separado da verdade interna do caso.</p>' +
            '</div>' +
            '<button id="scientificBaseClose" class="btn" type="button">Fechar</button>' +
          '</div>' +

          '<div class="scientific-source-row">' +
            '<a class="scientific-source" href="https://www.msdmanuals.com/pt/profissional/" target="_blank" rel="noopener">Manual MSD — Profissionais ↗</a>' +
            '<a class="scientific-source" href="https://www.gov.br/saude/pt-br/assuntos/pcdt" target="_blank" rel="noopener">Ministério da Saúde — PCDT ↗</a>' +
          '</div>' +

          '<div class="scientific-section"><h3>Fisiopatologia</h3><p>' + escapeHTML(pathophysiology) + '</p></div>' +
          '<div class="scientific-section"><h3>Propedêutica</h3><p>' + escapeHTML(propedeutics) + '</p></div>' +
          '<div class="scientific-section"><h3>Tratamento e manejo</h3><p>' + escapeHTML(treatment) + '</p></div>' +
          '<div class="scientific-section"><h3>Complicações e evolução</h3><p>' + escapeHTML(complications) + '</p></div>' +

          (evidenceItems
            ? '<div class="scientific-section"><h3>Evidências localizadas nesta execução</h3>' + evidenceItems + '</div>'
            : '<div class="scientific-empty">Nenhum texto externo foi recuperado nesta execução. As fontes oficiais continuam disponíveis acima. O sistema não preenche essa lacuna com conhecimento inventado.</div>') +

          '<div class="scientific-disclaimer">A Base Científica é um modo educacional. O conteúdo deve ser interpretado no contexto clínico e nas versões atuais das fontes.</div>' +
        '</div>';

      this.root.querySelector("#scientificBaseClose")?.addEventListener("click", () => this.close());
    }
  }

  global.ScientificBase = ScientificBase;

  global.addEventListener("DOMContentLoaded", () => {
    const engine = global.idmtEngine;
    if (!engine) return;

    engine.scientificBase = new ScientificBase(engine);

    const science = document.getElementById("scienceBtn");
    if (science) {
      science.addEventListener("click", () => engine.scientificBase.open());
    }
  });
})(window);
