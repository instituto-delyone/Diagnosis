(() => {
  "use strict";

  const overlay = document.getElementById("casePreparationOverlay");
  const statusRoot = document.getElementById("prepStatus");
  const errorRoot = document.getElementById("prepError");
  const cardsRoot = document.getElementById("prepCards");
  const subtitle = document.getElementById("prepSubtitle");

  const statusRow = (name, state, detail = "") => {
    let row = document.querySelector('[data-prep-status="' + CSS.escape(name) + '"]');
    if (!row) {
      row = document.createElement("div");
      row.className = "prep-status-row";
      row.dataset.prepStatus = name;
      row.innerHTML = '<span class="prep-status-name"></span><span class="prep-status-state"></span><span class="prep-status-detail"></span>';
      statusRoot.appendChild(row);
    }
    row.querySelector(".prep-status-name").textContent = name;
    row.querySelector(".prep-status-state").textContent = state;
    row.querySelector(".prep-status-detail").textContent = detail;
  };

  const hidePreparation = () => {
    document.body.classList.remove("preparing");
    overlay?.classList.add("prep-hidden");
  };

  const activate = (engine, item) => {
    engine.activatePreparedCase(item.case);
    engine.__activePreparedCase = item;
    hidePreparation();
  };

  async function boot() {
    if (!window.idmtEngine || !window.CasePreparationEngine) return;

    const engine = window.idmtEngine;
    statusRoot.innerHTML = "";
    errorRoot.classList.add("prep-hidden");
    cardsRoot.innerHTML = "";
    cardsRoot.classList.add("prep-hidden");
    subtitle.textContent = "Aguardando a geração de pelo menos um paciente clínico.";

    try {
      statusRow("engine", "ok", "motor clínico disponível");
      statusRow("knowledge base", "carregando", "lendo os módulos clínicos");

      const preparation = new window.CasePreparationEngine({ engine });
      engine.__casePreparation = preparation;

      await engine.boot();

      const adapterReady = await preparation.loadGenerationLayer();
      const sourceStatus = preparation.knowledgeAdapter.getSourceStatus();

      sourceStatus.forEach(source => {
        statusRow(source.path, source.state === "ok" ? "ok" : "erro",
          source.state === "ok" ? source.entities + " entidades clínicas lidas" : source.error);
      });

      statusRow("knowledge base", "ok",
        preparation.knowledgeAdapter.getLoadedSourceCount() + " arquivo(s) clínico(s) carregado(s) · " +
        preparation.knowledgeAdapter.entities.length + " conceitos");

      const first = await preparation.prepareFirst(statusRow);
      activate(engine, first);

      // The first patient is playable now. The rest of the generation is deliberately
      // non-blocking and does not gate the conversation.
      statusRow("casos seguintes", "carregando", "gerando em segundo plano");
      preparation.prepareRemaining(2, statusRow, [first.sourceCase.primary_concept])
        .then(items => {
          engine.__backgroundPreparedCases = items;
          statusRow("casos seguintes", "ok", items.length + " caso(s) adicional(is) prontos em segundo plano");
        })
        .catch(error => {
          console.warn("Geração dos casos seguintes falhou:", error);
          statusRow("casos seguintes", "erro", error.message || String(error));
        });

      // Keep local references warm without invoking Gemini.
      preparation.backgroundWarmup();
    } catch (error) {
      console.error("Falha na preparação inicial:", error);
      statusRow("preparação", "erro", error.message || String(error));
      errorRoot.textContent = "A geração automática não ficou disponível nesta execução. O restante do Diagnosis permanece acessível.";
      errorRoot.classList.remove("prep-hidden");
      hidePreparation();
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    boot().catch(error => console.error("Diagnosis bootstrap failure:", error));
  });
})();
