(function (global) {
  "use strict";

  if (!global.DiagnosisEngine || global.__diagnosisClinicalFlowInstalled) return;
  global.__diagnosisClinicalFlowInstalled = true;

  const normalize = value => String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const escapeHTML = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const oldRenderInitialCase = global.DiagnosisEngine.prototype.renderInitialCase;
  const oldProcessAction = global.DiagnosisEngine.prototype.processAction;

  function targetFor(engine, kind) {
    const hidden = engine.currentCase?.hidden || {};
    const truth = engine.currentCase?.clinical_truth || {};
    if (kind === "syndromic") {
      return hidden.syndromic_diagnosis ||
        hidden.syndrome ||
        truth.syndromic_diagnosis ||
        engine.currentCase?.syndromic_diagnosis ||
        null;
    }
    return hidden.etiologic_diagnosis ||
      hidden.diagnosis ||
      hidden.label ||
      engine.currentCase?.primary_concept ||
      null;
  }

  function similarity(text, target) {
    const value = normalize(text);
    const goal = normalize(target);
    if (!value || !goal) return 0;
    if (value === goal) return 1;
    if (goal.includes(value) || value.includes(goal)) return 0.9;

    const a = new Set(value.split(" ").filter(Boolean));
    const b = new Set(goal.split(" ").filter(Boolean));
    const intersection = [...a].filter(x => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union ? intersection / union : 0;
  }

  function ensureFlowState(engine) {
    const ctx = engine.context || (engine.context = engine.createContext());
    ctx.clinicalFlow = ctx.clinicalFlow || {
      firstHypothesisAsked: false,
      diagnosis: {
        syndromic: { attempts: 0, maxAttempts: 3, solved: false, lastScore: 0, lastText: "" },
        etiologic: { attempts: 0, maxAttempts: 3, solved: false, lastScore: 0, lastText: "" }
      },
      monitoring: {
        active: false,
        activatedAt: null,
        alerts: []
      },
      treatment: {
        unlocked: false,
        stabilizationDone: false,
        researchRequested: false
      }
    };
    return ctx.clinicalFlow;
  }

  function treatmentText(value) {
    const n = normalize(value);
    return /\b(oxigen|oxigenacao|oximetr|monitor|monitoriz|monitorar|vni|ventilacao|intub|cristaloid|fluido|soro|acesso venoso|vasopressor|noradren|adrenal|ressuscit|reanima|abc|via aerea)\w*/.test(n);
  }

  function looksLikeTreatment(value) {
    const n = normalize(value);
    return /\b(trat|prescrev|administ|medic|terapia|manejo|conduta|oxigen|antibiot|cortico|broncodilat|analges|anticoagul|insulina|transfus|repor|hidrata|internar|vni|intub|ventila)\w*/.test(n);
  }

  function readBP(value) {
    const match = String(value || "").match(/(\d{2,3})\s*[\/-]\s*(\d{2,3})/);
    if (!match) return null;
    const systolic = Number(match[1]);
    const diastolic = Number(match[2]);
    if (!systolic || !diastolic) return null;
    return {
      systolic,
      diastolic,
      map: Math.round((systolic + 2 * diastolic) / 3)
    };
  }

  function currentVitals(engine) {
    const p = engine.currentCase?.presentation?.vitals || {};
    const pe = engine.currentCase?.physical_exam?.vitals ||
      engine.currentCase?.physical_exam?.vital_signs || {};
    const merged = Object.assign({}, pe, p);
    const bp = readBP(merged.BP || merged.bp || merged.pa || merged.PA);
    return {
      bp,
      spo2: Number.parseFloat(String(merged.SpO2 || merged.spo2 || "").replace(",", ".")),
      rr: Number.parseFloat(String(merged.RR || merged.rr || merged.fr || "").replace(",", ".")),
      hr: Number.parseFloat(String(merged.HR || merged.hr || merged.fc || "").replace(",", "."))
    };
  }

  global.DiagnosisEngine.prototype.initializeClinicalFlow = function () {
    const flow = ensureFlowState(this);
    flow.diagnosis.syndromic.maxAttempts = 3;
    flow.diagnosis.etiologic.maxAttempts = 3;

    this.renderDiagnosisPanels();
    this.updateMonitoring();

    if (!flow.firstHypothesisAsked) {
      flow.firstHypothesisAsked = true;
      this.log("SISTEMA", "Doutor, qual é a sua primeira hipótese diagnóstica?");
    }
  };

  global.DiagnosisEngine.prototype.renderDiagnosisPanels = function () {
    const flow = ensureFlowState(this);
    const root = document.getElementById("diagnosisPanels");
    if (!root) return;

    const renderPanel = (kind, title, subtitle, placeholder, unlocked) => {
      const state = flow.diagnosis[kind];
      const target = targetFor(this, kind);
      const disabled = !unlocked || state.solved || state.attempts >= state.maxAttempts || flow.treatment?.unlocked;
      const feedback = state.lastText
        ? '<div class="diagnosis-feedback">' + escapeHTML(state.lastText) + '</div>'
        : "";

      return '<section class="diagnosis-stage ' + (unlocked ? "is-unlocked" : "is-locked") + '">' +
        '<div class="diagnosis-stage-head">' +
          '<div><strong>' + escapeHTML(title) + '</strong><span>' + escapeHTML(subtitle) + '</span></div>' +
          '<b>' + state.attempts + '/' + state.maxAttempts + '</b>' +
        '</div>' +
        '<div class="hypothesis-row">' +
          '<input id="' + kind + 'DiagnosisInput" class="hypothesis-input" type="text" ' +
            'placeholder="' + escapeHTML(placeholder) + '" ' +
            (disabled ? "disabled" : "") + '>' +
          '<button id="' + kind + 'DiagnosisSubmit" class="btn btn-primary hypothesis-submit" type="button" ' +
            (disabled ? "disabled" : "") + '>Avaliar</button>' +
        '</div>' +
        '<div class="hypothesis-status">' +
          (state.solved ? "Hipótese aceita." :
            state.attempts >= state.maxAttempts ? "Limite de tentativas atingido." :
            !unlocked ? "Aguardando a etapa anterior." :
            target ? "O sistema avaliará a coerência da hipótese com a verdade clínica." :
            "Esta etapa ainda não possui alvo específico configurado no caso.") +
        '</div>' +
        feedback +
      '</section>';
    };

    root.innerHTML =
      '<div class="diagnosis-panels-title">Raciocínio diagnóstico</div>' +
      '<p class="hypothesis-help">Comece pela síndrome. Depois refine para a etiologia. Cada etapa permite até 3 tentativas e fornece feedback imediato.</p>' +
      renderPanel("syndromic", "Diagnóstico sindrômico", "Qual síndrome explica o conjunto apresentado?", "Ex.: síndrome respiratória aguda", true) +
      renderPanel("etiologic", "Diagnóstico etiológico", "Qual é a doença/causa responsável?", "Ex.: exacerbação infecciosa de DPOC", flow.diagnosis.syndromic.solved || !targetFor(this, "syndromic"));

    ["syndromic", "etiologic"].forEach(kind => {
      const input = document.getElementById(kind + "DiagnosisInput");
      const button = document.getElementById(kind + "DiagnosisSubmit");
      if (!input || !button) return;
      const submit = () => this.submitDiagnosis(kind);
      button.addEventListener("click", submit);
      input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      });
    });
  };

  global.DiagnosisEngine.prototype.submitDiagnosis = function (kind) {
    const flow = ensureFlowState(this);
    const state = flow.diagnosis[kind];
    if (!state || state.solved || state.attempts >= state.maxAttempts) return;

    const input = document.getElementById(kind + "DiagnosisInput");
    const value = input?.value.trim();
    if (!value) return;

    state.attempts += 1;
    state.lastText = value;
    state.lastScore = similarity(value, targetFor(this, kind));

    const hasTarget = Boolean(targetFor(this, kind));
    const accepted = hasTarget
      ? state.lastScore >= 0.72
      : kind === "syndromic";

    this.context.history.push("[DIAGNÓSTICO " + kind + "] " + value);

    if (accepted) {
      state.solved = true;
      if (kind === "syndromic") {
        state.lastText = "Hipótese sindrômica coerente. Agora procure a etiologia.";
        this.context.phase = "diagnosis";
      } else {
        state.lastText = "Diagnóstico etiológico coerente. A etapa terapêutica foi liberada.";
        flow.treatment.unlocked = true;
        this.context.phase = "treatment";
      }
      this.context.score += kind === "syndromic" ? 10 : 50;
      this.syncCompatibilityState();
      this.log("FEEDBACK", state.lastText);
    } else if (state.attempts >= state.maxAttempts) {
      state.lastText = "As três tentativas foram utilizadas. O caso será encerrado e avaliado com o que foi produzido até aqui.";
      this.log("ENCERRAMENTO", state.lastText);
      this.endCase?.({ reason: "diagnosis_attempts_exhausted" });
      return;
    } else {
      state.lastText = kind === "syndromic"
        ? "Ainda não. Reavalie os achados e tente formular a síndrome novamente."
        : "Ainda não. Você pode revisar a anamnese, exame físico ou exames antes da próxima tentativa.";
      this.context.errors += 1;
      this.log("FEEDBACK", state.lastText);
    }

    this.renderDiagnosisPanels();
    this.renderState();
  };

  global.DiagnosisEngine.prototype.activateMonitoring = function () {
    const flow = ensureFlowState(this);
    flow.monitoring.active = true;
    flow.monitoring.activatedAt = Date.now();
    this.context.history.push("[MONITORIZAÇÃO] Monitorização clínica ativada.");
    this.log("MONITOR", "Monitorização clínica ativada. Os parâmetros vitais passam a ser acompanhados pelo Engine.");
    this.updateMonitoring();
  };

  global.DiagnosisEngine.prototype.updateMonitoring = function () {
    const flow = ensureFlowState(this);
    const root = document.getElementById("monitor");
    if (root) root.classList.toggle("monitor-active", Boolean(flow.monitoring.active));

    const vitals = currentVitals(this);
    const alerts = flow.monitoring.alerts || [];

    if (flow.monitoring.active && vitals.bp?.map != null && vitals.bp.map < 65) {
      if (!alerts.includes("map_lt_65")) {
        alerts.push("map_lt_65");
        this.log("ALERTA", "PAM abaixo de 65 mmHg: sinal de hipotensão grave/hipoperfusão. Avalie choque e intervenha conforme o quadro.");
      }
    }

    if (flow.monitoring.active && Number.isFinite(vitals.spo2) && vitals.spo2 < 90) {
      if (!alerts.includes("spo2_lt_90")) {
        alerts.push("spo2_lt_90");
        this.log("ALERTA", "SpO₂ abaixo de 90%: hipoxemia relevante. Reavalie oxigenação e gravidade.");
      }
    }

    flow.monitoring.alerts = alerts;
  };

  global.DiagnosisEngine.prototype.researchTreatment = async function (input) {
    const flow = ensureFlowState(this);
    flow.treatment.researchRequested = true;

    if (typeof this.researchOnDemand === "function") {
      try {
        await this.researchOnDemand("Pesquisar conduta terapêutica: " + input);
      } catch (error) {
        console.warn("Pesquisa terapêutica não concluída:", error);
      }
    }
  };

  const oldRenderState = global.DiagnosisEngine.prototype.renderState;
  global.DiagnosisEngine.prototype.renderState = function () {
    const result = oldRenderState?.apply(this, arguments);
    this.updateMonitoring();
    return result;
  };

  global.DiagnosisEngine.prototype.renderInitialCase = function () {
    const result = oldRenderInitialCase?.apply(this, arguments);
    this.initializeClinicalFlow();
    return result;
  };

  global.DiagnosisEngine.prototype.processAction = async function (input) {
    const flow = ensureFlowState(this);
    const n = normalize(input);

    if (/\b(monitorizar|monitorar|iniciar monitorizacao|iniciar monitoramento|colocar em monitorizacao|colocar em monitoramento)\b/.test(n)) {
      this.activateMonitoring();
      return;
    }

    if (looksLikeTreatment(input) && !/\b(qual tratamento|posso tratar|o que fazer)\b/.test(n)) {
      if (!flow.treatment.unlocked) {
        this.log("FEEDBACK", "O tratamento ainda não foi liberado: estabeleça primeiro o diagnóstico etiológico.");
        return;
      }

      const wasStabilization = treatmentText(input);
      const response = await oldProcessAction.call(this, input);
      await this.researchTreatment(input);

      if (this.context?.caseEnded) return;

      if (!wasStabilization) {
        this.log("ENCERRAMENTO", "Conduta terapêutica registrada sem etapa de estabilização identificada. O caso será encerrado para avaliação.");
        this.endCase?.({ reason: "non_stabilization_treatment" });
      } else {
        flow.treatment.stabilizationDone = true;
        this.log("FEEDBACK", "Estabilização registrada. Reavalie os parâmetros e prossiga conforme a resposta clínica.");
        this.renderDiagnosisPanels();
      }
      return response;
    }

    return oldProcessAction.call(this, input);
  };

  global.DiagnosisEngine.prototype.renderState = global.DiagnosisEngine.prototype.renderState;

})(window);
