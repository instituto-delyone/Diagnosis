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

    async open() {
      if (!this.root) return;
      this.root.classList.remove("scientific-base-hidden");
      document.body.classList.add("scientific-base-open");

      if (!this.engine.research && typeof this.engine.researchOnDemand === "function") {
        await this.engine.researchOnDemand("Base científica solicitada pelo médico.");
      }

      this.render();
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
        "A fisiopatologia específica desta condição deve ser consultada nas fontes científicas indicadas abaixo.";

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
          : "O tratamento específico não está descrito na base local deste caso.");

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

      const diagnosticPoints = [
        ...(Array.isArray(history.symptoms) ? history.symptoms.map(x => "Manifestação: " + x) : []),
        ...(Array.isArray(physical.findings) ? physical.findings.map(x => "Achado: " + x) : []),
        ...(Array.isArray(c.differential) ? c.differential.map(x => {
          const name = typeof x === "string" ? x : (x.name || x.diagnosis || x.label || "");
          const discriminator = typeof x === "object" ? (x.discriminating_features || x.discriminator || "") : "";
          return name ? "Diferencial: " + name + (discriminator ? " · discriminador: " + asText(discriminator) : "") : "";
        }) : []),
        ...(Array.isArray(investigations.available)
          ? investigations.available.map(x => {
              const name = x.exam || x.name || x.id;
              return name ? "Investigação útil: " + name : "";
            })
          : [])
      ].filter(Boolean).slice(0, 24);

      const diagnosticItems = diagnosticPoints.length
        ? diagnosticPoints.map(x => '<li>' + escapeHTML(x) + '</li>').join("")
        : '<li>Os pontos diagnósticos específicos ainda não estão estruturados para este caso.</li>';

      const refTests = Array.isArray(this.engine.referenceRanges?.tests)
        ? this.engine.referenceRanges.tests
        : [];

      const examDefinitions = Array.isArray(this.engine.examinationRules?.examinations)
        ? this.engine.examinationRules.examinations
        : [];

      const examMap = new Map();
      [...examDefinitions.map(x => ({...x, _kind: "examination"})), ...refTests.map(x => ({...x, _kind: "reference"}))]
        .forEach(item => {
          const id = item.id || item.name;
          if (id && !examMap.has(id)) examMap.set(id, item);
        });

      const examRows = [...examMap.values()].slice(0, 80).map(item => {
        const name = item.name || item.id || "Exame";
        const aliases = Array.isArray(item.aliases) ? item.aliases.slice(0, 4).join(", ") : "";
        const unit = item.unit || "";
        const reference = item.reference
          ? Object.entries(item.reference).map(([k, v]) => k + ": " + v).join(" · ")
          : "";
        const normal = item.normal
          ? Object.entries(item.normal).map(([k, v]) => {
              if (v && typeof v === "object" && v.min !== undefined) return k + ": " + v.min + "–" + v.max;
              return k + ": " + asText(v);
            }).join(" · ")
          : "";
        return (
          '<tr>' +
            '<td><strong>' + escapeHTML(name) + '</strong>' +
              (aliases ? '<small>' + escapeHTML(aliases) + '</small>' : '') +
            '</td>' +
            '<td>' + escapeHTML(unit || "—") + '</td>' +
            '<td>' + escapeHTML(reference || normal || "Consultar laudo/método") + '</td>' +
          '</tr>'
        );
      }).join("");

      const examTable = examRows
        ? '<div class="science-table-wrap"><table class="science-table"><thead><tr><th>Exame/parâmetro</th><th>Unidade</th><th>Referência educacional</th></tr></thead><tbody>' + examRows + '</tbody></table></div>'
        : '<p>Nenhuma tabela de exames foi carregada nesta execução.</p>';

      this.root.innerHTML =
        '<div class="scientific-base-card">' +
          '<div class="scientific-base-header">' +
            '<div>' +
              '<div class="scientific-base-kicker">BASE CIENTÍFICA</div>' +
              '<h2>' + escapeHTML(diagnosis) + '</h2>' +
              '<p>Conhecimento, pontos diagnósticos e referências ficam separados da verdade interna do caso.</p>' +
            '</div>' +
            '<button id="scientificBaseClose" class="btn" type="button">Fechar</button>' +
          '</div>' +

          '<div class="science-tabs" role="tablist">' +
            '<button type="button" class="science-tab active" data-science-tab="knowledge">Conhecimento</button>' +
            '<button type="button" class="science-tab" data-science-tab="diagnostic">Pontos diagnósticos</button>' +
            '<button type="button" class="science-tab" data-science-tab="exams">Exames e referências</button>' +
            '<button type="button" class="science-tab" data-science-tab="sources">Fontes</button>' +
          '</div>' +

          '<div class="science-tab-panel active" data-science-panel="knowledge">' +
            '<div class="scientific-section"><h3>Fisiopatologia</h3><p>' + escapeHTML(pathophysiology) + '</p></div>' +
            '<div class="scientific-section"><h3>Propedêutica</h3><p>' + escapeHTML(propedeutics) + '</p></div>' +
            '<div class="scientific-section"><h3>Tratamento e manejo</h3><p>' + escapeHTML(treatment) + '</p></div>' +
            '<div class="scientific-section"><h3>Complicações e evolução</h3><p>' + escapeHTML(complications) + '</p></div>' +
          '</div>' +

          '<div class="science-tab-panel" data-science-panel="diagnostic">' +
            '<div class="scientific-section"><h3>Pontos de diagnóstico e constatação</h3>' +
              '<p>Elementos já disponíveis para sustentar, diferenciar ou investigar hipóteses. Não são uma resposta automática.</p>' +
              '<ul class="science-list">' + diagnosticItems + '</ul>' +
            '</div>' +
          '</div>' +

          '<div class="science-tab-panel" data-science-panel="exams">' +
            '<div class="scientific-section"><h3>Exames e parâmetros de referência</h3>' +
              '<p>Valores gerais são educacionais. Quando o caso trouxer intervalo próprio, o intervalo do caso prevalece.</p>' +
              examTable +
            '</div>' +
          '</div>' +

          '<div class="science-tab-panel" data-science-panel="sources">' +
            '<div class="scientific-source-row">' +
              '<a class="scientific-source" href="https://www.msdmanuals.com/pt/profissional/" target="_blank" rel="noopener">Manual MSD — Profissionais ↗</a>' +
              '<a class="scientific-source" href="https://www.gov.br/saude/pt-br/assuntos/pcdt" target="_blank" rel="noopener">Ministério da Saúde — PCDT ↗</a>' +
            '</div>' +
            (evidenceItems
              ? '<div class="scientific-section"><h3>Evidências localizadas nesta execução</h3>' + evidenceItems + '</div>'
              : '<div class="scientific-empty">Nenhuma evidência externa foi recuperada nesta execução.</div>') +
          '</div>' +

          '<div class="scientific-disclaimer">A Base Científica é um modo educacional. Intervalos laboratoriais variam conforme laboratório, método, idade, sexo, gestação e contexto.</div>' +
        '</div>';

      if (!document.getElementById("scientificBaseTabsStyle")) {
        const style = document.createElement("style");
        style.id = "scientificBaseTabsStyle";
        style.textContent = `
          .science-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:10px}
          .science-tab{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:inherit;border-radius:8px;padding:8px 12px;cursor:pointer}
          .science-tab.active{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.28)}
          .science-tab-panel{display:none}.science-tab-panel.active{display:block}
          .science-list{margin:0;padding-left:20px}.science-list li{margin:7px 0;line-height:1.5}
          .science-table-wrap{overflow:auto;max-height:55vh;border:1px solid rgba(255,255,255,.10);border-radius:10px}
          .science-table{width:100%;border-collapse:collapse;min-width:650px}
          .science-table th,.science-table td{text-align:left;padding:10px;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:top}
          .science-table th{position:sticky;top:0;background:#101a28;z-index:1}
          .science-table small{display:block;opacity:.65;margin-top:3px}
        `;
        document.head.appendChild(style);
      }

      this.root.querySelectorAll("[data-science-tab]").forEach(button => {
        button.addEventListener("click", () => {
          const target = button.dataset.scienceTab;
          this.root.querySelectorAll("[data-science-tab]").forEach(x => x.classList.toggle("active", x === button));
          this.root.querySelectorAll("[data-science-panel]").forEach(panel => {
            panel.classList.toggle("active", panel.dataset.sciencePanel === target);
          });
        });
      });

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
