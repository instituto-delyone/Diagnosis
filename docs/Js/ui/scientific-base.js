/* DIAGNOSIS — SCIENTIFIC BASE V1
   One click -> scientific card.
   No LLM, no external search, no changes to clinical state.
   Content lives separately in scientific-base-data.js.
*/
(function () {
    "use strict";

    function esc(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function ensureStyles() {
        if (document.getElementById("scientificBaseStyles")) return;
        const style = document.createElement("style");
        style.id = "scientificBaseStyles";
        style.textContent = `
            .scientific-base-overlay{position:fixed;inset:0;z-index:9999;display:flex;
              align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72);
              backdrop-filter:blur(5px)}
            .scientific-base-panel{width:min(820px,96vw);max-height:88vh;overflow:hidden;
              display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.12);
              border-radius:16px;background:#10161d;color:#e8eef4;
              box-shadow:0 24px 80px rgba(0,0,0,.55)}
            .scientific-base-header{display:flex;align-items:center;gap:16px;padding:16px 18px;
              border-bottom:1px solid rgba(255,255,255,.08)}
            .scientific-base-title{font-size:18px;font-weight:700;flex:1}
            .scientific-base-subtitle{margin-top:3px;font-size:12px;opacity:.65}
            .scientific-base-timer{min-width:64px;text-align:center;
              font-variant-numeric:tabular-nums;font-weight:800;font-size:18px}
            .scientific-base-close{border:0;background:transparent;color:#cbd5df;
              font-size:22px;cursor:pointer;padding:4px 8px}
            .scientific-base-body{overflow-y:auto;padding:18px}
            .scientific-base-section{margin-bottom:16px;padding:13px 14px;border-radius:11px;
              background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.055)}
            .scientific-base-section h3{margin:0 0 7px;font-size:13px;text-transform:uppercase;
              letter-spacing:.04em;opacity:.7}
            .scientific-base-section p{margin:0;line-height:1.55;white-space:pre-wrap}
            .scientific-base-sources{font-size:12px;line-height:1.5;opacity:.78}
            .scientific-base-empty{padding:24px 10px;text-align:center;opacity:.7}
        `;
        document.head.appendChild(style);
    }

    function conditionFrom(caseData) {
        const hidden = caseData?.hidden || {};
        return hidden.targetEntity || caseData?.targetEntity ||
               caseData?.condition || caseData?.diagnosis || null;
    }

    function findRecord(condition) {
        const db = window.DIAGNOSIS_SCIENTIFIC_BASE || {};
        if (!condition) return null;
        const key = String(condition).trim().toLowerCase();
        const match = Object.keys(db).find(k => k.toLowerCase() === key);
        return match ? db[match] : null;
    }

    function render(record, condition) {
        if (!record) {
            return `<div class="scientific-base-empty">
                Ainda não existe uma ficha científica cadastrada para
                <strong>${esc(condition || "esta condição")}</strong>.
            </div>`;
        }

        const fields = [
            ["Etiologia", record.etiology],
            ["Fisiopatologia", record.pathophysiology],
            ["Epidemiologia", record.epidemiology],
            ["Manifestações clínicas", record.clinical],
            ["Diagnóstico", record.diagnosis],
            ["Diagnóstico diferencial", record.differential],
            ["Tratamento", record.treatment],
            ["Complicações", record.complications],
            ["Red flags", record.redFlags]
        ];

        const html = fields.filter(([,v]) => v).map(([title,value]) => `
            <section class="scientific-base-section">
                <h3>${esc(title)}</h3>
                <p>${esc(value)}</p>
            </section>`).join("");

        const refs = (record.references || []).map(r => `• ${esc(r)}`).join("<br>");
        return html + `<section class="scientific-base-section">
            <h3>Fontes</h3>
            <div class="scientific-base-sources">
                ${refs || "Fontes ainda não cadastradas."}
            </div>
        </section>`;
    }

    function open({ caseData }) {
        ensureStyles();
        document.getElementById("scientificBaseOverlay")?.remove();

        const condition = conditionFrom(caseData);
        const record = findRecord(condition);

        const overlay = document.createElement("div");
        overlay.id = "scientificBaseOverlay";
        overlay.className = "scientific-base-overlay";
        overlay.innerHTML = `
            <div class="scientific-base-panel" role="dialog" aria-modal="true"
                 aria-label="Base científica">
                <header class="scientific-base-header">
                    <div class="scientific-base-title">
                        📚 Base científica
                        <div class="scientific-base-subtitle">
                            ${esc(record?.condition || condition || "Condição não identificada")}
                        </div>
                    </div>
                    <div class="scientific-base-timer" id="scientificBaseTimer">01:00</div>
                    <button class="scientific-base-close" type="button" aria-label="Fechar">×</button>
                </header>
                <main class="scientific-base-body">${render(record, condition)}</main>
            </div>`;

        document.body.appendChild(overlay);

        let remaining = 60;
        const timer = overlay.querySelector("#scientificBaseTimer");
        const interval = setInterval(() => {
            remaining = Math.max(0, remaining - 1);
            timer.textContent =
                `${String(Math.floor(remaining/60)).padStart(2,"0")}:${String(remaining%60).padStart(2,"0")}`;
            if (!remaining) clearInterval(interval);
        }, 1000);

        const close = () => { clearInterval(interval); overlay.remove(); };
        overlay.querySelector(".scientific-base-close").addEventListener("click", close);
        overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    }

    window.ScientificBaseUI = { open };
})();
