"use strict";

/*
 * Diagnosys — final review + knowledge drawer.
 *
 * UI layer only:
 * - exposes loaded knowledge/provider status;
 * - makes case difficulty visible;
 * - provides transfer/discharge controls;
 * - presents a post-case educational review;
 * - delegates scientific review to ScientificBase.
 *
 * The clinical truth remains owned by DiagnosisEngine.
 */
(function (global) {
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

    function installStyle() {
        if (document.getElementById("diagnosysFinalReviewStyle")) return;

        const style = document.createElement("style");
        style.id = "diagnosysFinalReviewStyle";
        style.textContent = `
            .system-drawer-toggle{
                position:fixed;right:14px;bottom:12px;z-index:1200;
                border:1px solid rgba(255,255,255,.10);background:rgba(8,21,34,.72);
                color:#7890a3;border-radius:999px;padding:7px 10px;font-size:10px;
                backdrop-filter:blur(8px);cursor:pointer;opacity:.62;
                transition:opacity .18s,transform .18s,border-color .18s;
            }
            .system-drawer-toggle:hover{opacity:1;transform:translateY(-1px);border-color:rgba(56,189,248,.35)}
            .system-drawer{
                position:fixed;right:14px;bottom:52px;z-index:1199;
                width:min(390px,calc(100vw - 28px));max-height:70vh;overflow:auto;
                padding:16px;background:rgba(9,19,31,.97);border:1px solid #23435a;
                border-radius:15px;box-shadow:0 22px 70px rgba(0,0,0,.42);
                display:none;
            }
            .system-drawer.open{display:block}
            .system-drawer h3{margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase}
            .system-drawer-sub{margin:0 0 12px;color:#7890a3;font-size:11px;line-height:1.5}
            .system-source-row{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)}
            .system-source-name{font-size:12px}.system-source-state{font-size:10px;font-weight:800}
            .system-source-state.ok{color:#34d399}.system-source-state.warn{color:#fbbf24}.system-source-state.off{color:#fb7185}
            .system-drawer-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
            .system-meta-card{padding:9px;border:1px solid rgba(255,255,255,.07);border-radius:9px;background:rgba(255,255,255,.025)}
            .system-meta-card span{display:block;color:#7890a3;font-size:9px;text-transform:uppercase;letter-spacing:.08em}
            .system-meta-card strong{display:block;margin-top:4px;font-size:12px}
            .review-overlay{
                position:fixed;inset:0;z-index:1500;display:flex;align-items:center;justify-content:center;
                padding:20px;background:rgba(3,9,16,.88);backdrop-filter:blur(10px);
            }
            .review-card{
                width:min(1050px,100%);max-height:92vh;overflow:auto;padding:24px;
                background:#0d1b2a;border:1px solid #294b62;border-radius:20px;
                box-shadow:0 28px 90px rgba(0,0,0,.48);
            }
            .review-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
            .review-kicker{color:#38bdf8;font-size:10px;font-weight:850;letter-spacing:.13em}
            .review-title{margin:5px 0;font-size:26px}.review-sub{margin:0;color:#8fa7ba;font-size:12px;line-height:1.55}
            .review-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin:18px 0}
            .review-metric{padding:12px;border:1px solid #1d3a52;border-radius:11px;background:rgba(255,255,255,.025)}
            .review-metric span{display:block;color:#8fa7ba;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
            .review-metric strong{display:block;margin-top:6px;font-size:20px}
            .review-check{color:#34d399}.review-muted{color:#8fa7ba}
            .review-section{margin-top:13px;padding:15px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.018)}
            .review-section h3{margin:0 0 7px;font-size:14px}.review-section p{margin:0;color:#dce8f1;font-size:12px;line-height:1.65}
            .review-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
            .review-source{display:inline-flex;margin:5px 5px 0 0;padding:6px 9px;border-radius:7px;background:rgba(56,189,248,.06);border:1px solid rgba(56,189,248,.18);color:#bfeaff;font-size:10px}
            .transfer-panel{margin-top:10px;padding:11px;border:1px solid rgba(56,189,248,.18);border-radius:10px;background:rgba(56,189,248,.04)}
            .transfer-panel select{width:100%;margin:6px 0;padding:9px;background:#081522;color:#e8f0f7;border:1px solid #1d3a52;border-radius:8px}
            @media(max-width:800px){.review-grid{grid-template-columns:repeat(2,1fr)}}
        `;
        document.head.appendChild(style);
    }

    function sourceState(condition) {
        return condition ? ["ATIVO", "ok"] : ["INDISPONÍVEL", "off"];
    }

    class FinalReviewUI {
        constructor(engine) {
            this.engine = engine;
            this.drawer = null;
            this.overlay = null;
        }

        init() {
            installStyle();
            this.installDrawer();
            this.bindControls();
            this.refreshDifficulty();
        }

        installDrawer() {
            const toggle = document.createElement("button");
            toggle.className = "system-drawer-toggle";
            toggle.type = "button";
            toggle.textContent = "⌄ Sistema";
            toggle.title = "Conhecimento e componentes carregados";
            toggle.setAttribute("aria-expanded", "false");

            const drawer = document.createElement("aside");
            drawer.className = "system-drawer";
            drawer.setAttribute("aria-label", "Conhecimento e sistema carregados");

            document.body.append(toggle, drawer);
            this.drawer = drawer;

            toggle.addEventListener("click", () => {
                const open = drawer.classList.toggle("open");
                toggle.textContent = open ? "⌃ Sistema" : "⌄ Sistema";
                toggle.setAttribute("aria-expanded", String(open));
                if (open) this.renderDrawer();
            });
        }

        bindControls() {
            const end = document.getElementById("endCaseBtn");
            if (end) {
                end.textContent = "🏁 Encerrar caso e avaliar";
                end.classList.add("btn-warning");
                end.addEventListener("click", () => {
                    setTimeout(() => {
                        if (this.engine.context?.caseEnded) this.showReview();
                    }, 0);
                });
            }

            const next = document.getElementById("nextBtn");
            if (next) next.addEventListener("click", () => this.closeReview());

            const science = document.getElementById("scienceBtn");
            if (science) science.title = "Estudar a doença e consultar a Base Científica";
        }

        refreshDifficulty() {
            const difficulty = this.engine.currentCase?.difficulty || "não classificada";
            const el = document.getElementById("difficultyLabel");
            if (el) el.textContent = String(difficulty);
            const meta = document.getElementById("difficultyLabelMeta");
            if (meta) meta.textContent = String(difficulty);
        }

        renderDrawer() {
            if (!this.drawer) return;

            const engine = this.engine;
            const kb = engine.library;
            const research = engine.research;
            const geminiLoaded = !!global.DiagnosysGeminiProvider || !!global.DiagnosysGeminiConversationProvider;
            const localKnowledge = !!kb;
            const sources = [
                ["Motor clínico", true],
                ["Knowledge Base", localKnowledge && Number(kb?.stats?.files || 0) > 0],
                ["Casos carregados", Number(kb?.stats?.playable || 0) > 0],
                ["PCDT", !!engine.pcdtCatalog],
                ["Faixas de referência", !!engine.referenceRanges],
                ["MSD / pesquisa científica", !!global.CaseResearchEngine],
                ["Base Científica", !!global.ScientificBase || !!engine.scientificBase],
                ["Conversation Engine / logger", !!engine.conversationLogger],
                ["Gemini — provider", geminiLoaded],
                ["Gemini — última síntese", research?.gemini_status === "ok"]
            ];

            const rows = sources.map(([name, active]) => {
                const [label, cls] = sourceState(active);
                return '<div class="system-source-row"><span class="system-source-name">' +
                    escapeHTML(name) + '</span><span class="system-source-state ' + cls + '">' +
                    label + '</span></div>';
            }).join("");

            const c = engine.currentCase || {};
            const caseId = c.id || c.case_id || "—";
            const difficulty = c.difficulty || "—";
            const files = Number(kb?.stats?.files || 0);
            const records = Number(kb?.stats?.records || 0);
            const revealed = engine.context?.revealed?.size || 0;

            this.drawer.innerHTML =
                '<h3>Conhecimento & sistema</h3>' +
                '<p class="system-drawer-sub">Painel técnico discreto para saber o que estava carregado quando uma resposta falhar ou variar.</p>' +
                rows +
                '<div class="system-drawer-meta">' +
                    '<div class="system-meta-card"><span>Caso</span><strong>' + escapeHTML(caseId) + '</strong></div>' +
                    '<div class="system-meta-card"><span>Dificuldade</span><strong>' + escapeHTML(difficulty) + '</strong></div>' +
                    '<div class="system-meta-card"><span>Fontes locais</span><strong>' + files + ' arquivos</strong></div>' +
                    '<div class="system-meta-card"><span>Registros</span><strong>' + records + '</strong></div>' +
                    '<div class="system-meta-card"><span>Investigações reveladas</span><strong>' + revealed + '</strong></div>' +
                    '<div class="system-meta-card"><span>Pesquisa</span><strong>' + escapeHTML(research?.gemini_status || "não solicitada") + '</strong></div>' +
                '</div>';
        }

        showReview() {
            this.closeReview();
            const result = this.engine.context?.caseResult || {};
            const c = this.engine.currentCase || {};
            const hypothesis = Number(result.hypothesisScore || 0);
            const treatment = result.actionScore == null ? null : Math.round(Number(result.actionScore) / 30 * 100);
            const investigations = Number(this.engine.context?.revealed?.size || 0);
            const available = Array.isArray(c?.investigations?.catalog)
                ? c.investigations.catalog.filter(x => x && x.available !== false).length
                : 0;
            const propedeutics = available
                ? Math.round(Math.min(100, (investigations / Math.max(1, Math.min(available, 6))) * 100))
                : 0;

            const managementActions = Array.isArray(this.engine.context?.managementActions)
                ? this.engine.context.managementActions.length
                : 0;
            const resourceUse = Math.max(0, Math.min(100,
                available
                    ? Math.round(100 - Math.max(0, investigations - Math.min(available, 6)) * 8)
                    : (managementActions ? 75 : 50)
            ));

            const etiologicText = hypothesis >= 95 ? '<span class="review-check">✓ alcançado</span>'
                : escapeHTML(hypothesis + "% de proximidade");
            const syndromicText = hypothesis >= 95 ? '<span class="review-check">✓ alcançado</span>'
                : escapeHTML(Math.max(0, Math.min(100, Math.round(hypothesis * 1.05))) + "% de proximidade");

            const sources = [
                ["MSD Manuals", true],
                ["PCDT / Ministério da Saúde", !!this.engine.pcdtCatalog],
                ["Base local do caso", !!c.hidden]
            ].map(([name, active]) => active
                ? '<span class="review-source">● ' + escapeHTML(name) + '</span>'
                : "").join("");

            const overlay = document.createElement("div");
            overlay.className = "review-overlay";
            overlay.innerHTML =
                '<div class="review-card">' +
                    '<div class="review-head">' +
                        '<div>' +
                            '<div class="review-kicker">CASO ENCERRADO · DEBRIEFING</div>' +
                            '<h2 class="review-title">' + escapeHTML(c.hidden?.label || c.title || "Caso clínico") + '</h2>' +
                            '<p class="review-sub">A avaliação mede o percurso clínico e, em seguida, abre uma revisão educacional da doença.</p>' +
                        '</div>' +
                        '<button class="btn" data-review-close type="button">Fechar</button>' +
                    '</div>' +

                    '<div class="review-grid">' +
                        '<div class="review-metric"><span>Diagnóstico sindrômico</span><strong>' + syndromicText + '</strong></div>' +
                        '<div class="review-metric"><span>Diagnóstico etiológico</span><strong>' + etiologicText + '</strong></div>' +
                        '<div class="review-metric"><span>Propedêutica</span><strong>' + propedeutics + '%</strong></div>' +
                        '<div class="review-metric"><span>Tratamento</span><strong>' + (treatment == null ? "—" : treatment + "%") + '</strong></div>' +
                        '<div class="review-metric"><span>Uso de recursos</span><strong>' + resourceUse + '%</strong></div>' +
                    '</div>' +

                    '<div class="review-section">' +
                        '<h3>Resultado geral</h3>' +
                        '<p><strong>' + escapeHTML(result.total ?? 0) + '/100</strong> · hipótese ' +
                        escapeHTML(hypothesis) + '/100 · conduta ' + escapeHTML(result.actionScore ?? 0) + '/30 · ' +
                        escapeHTML(result.errors ?? 0) + ' erro(s) registrado(s).</p>' +
                    '</div>' +

                    '<div class="review-section">' +
                        '<h3>📚 Revisão educacional da doença</h3>' +
                        '<p>Fisiopatologia, quadro clínico, propedêutica, diagnóstico, diferenciais, tratamento e complicações ficam disponíveis na Base Científica. A pesquisa pode consultar a camada MSD/PCDT e o Gemini apenas como síntese.</p>' +
                        '<div>' + sources + '</div>' +
                    '</div>' +

                    '<div class="review-section">' +
                        '<h3>🚑 Destino do paciente</h3>' +
                        '<p>Use uma ação explícita para registrar a destinação final do caso.</p>' +
                        '<div class="review-actions">' +
                            '<button class="btn btn-success" data-disposition="alta" type="button">✓ Dar alta</button>' +
                            '<button class="btn" data-disposition="transferencia" type="button">↗ Transferir</button>' +
                        '</div>' +
                        '<div class="transfer-panel" data-transfer-panel hidden>' +
                            '<label for="transferDestination">Destino da transferência</label>' +
                            '<select id="transferDestination">' +
                                '<option value="">Selecione...</option>' +
                                '<option>UTI</option>' +
                                '<option>Hematologia</option>' +
                                '<option>Cardiologia</option>' +
                                '<option>Cirurgia</option>' +
                                '<option>Hospital de referência</option>' +
                                '<option>Outro serviço especializado</option>' +
                            '</select>' +
                            '<button class="btn btn-primary" data-confirm-transfer type="button">Confirmar transferência</button>' +
                        '</div>' +
                    '</div>' +

                    '<div class="review-actions">' +
                        '<button class="btn btn-primary" data-study-disease type="button">📖 Estudar a doença</button>' +
                        '<button class="btn" data-review-close type="button">Continuar</button>' +
                    '</div>' +
                '</div>';

            document.body.appendChild(overlay);
            this.overlay = overlay;

            overlay.querySelectorAll("[data-review-close]").forEach(button => {
                button.addEventListener("click", () => this.closeReview());
            });

            overlay.querySelector("[data-study-disease]")?.addEventListener("click", async () => {
                this.closeReview();
                await this.engine.scientificBase?.open();
            });

            overlay.querySelector("[data-disposition='alta']")?.addEventListener("click", () => {
                this.recordDisposition("alta");
            });

            const transferPanel = overlay.querySelector("[data-transfer-panel]");
            overlay.querySelector("[data-disposition='transferencia']")?.addEventListener("click", () => {
                transferPanel.hidden = !transferPanel.hidden;
            });

            overlay.querySelector("[data-confirm-transfer]")?.addEventListener("click", () => {
                const destination = overlay.querySelector("#transferDestination")?.value;
                if (!destination) return;
                this.recordDisposition("transferencia", destination);
            });
        }

        recordDisposition(type, destination = null) {
            const state = this.engine.context || {};
            state.disposition = {
                type,
                destination,
                timestamp: Date.now()
            };
            this.engine.conversationLogger?.logEvent("case_disposition", state.disposition);
            this.engine.log("DESTINO", type === "alta"
                ? "Alta registrada no encerramento."
                : "Transferência registrada para " + destination + ".");
            this.closeReview();
        }

        closeReview() {
            if (this.overlay) {
                this.overlay.remove();
                this.overlay = null;
            }
        }
    }

    global.addEventListener("DOMContentLoaded", () => {
        const engine = global.idmtEngine;
        if (!engine) return;
        engine.finalReviewUI = new FinalReviewUI(engine);
        engine.finalReviewUI.init();
    });
})(window);
