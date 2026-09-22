/* Diagnosis — Knowledge Base Status UI
 * Shows the knowledge actually loaded by CaseLibrary.
 */
"use strict";
(function(global){
    if(global.__diagnosisKnowledgeStatusUIInstalled)return;
    global.__diagnosisKnowledgeStatusUIInstalled=true;
    const LABELS=[
        [/cardiopatias|cardiologia/,"Cardiologia"],
        [/reumatologia/,"Reumatologia"],
        [/endocrinologia/,"Endocrinologia"],
        [/neurologia/,"Neurologia"],
        [/pneumologia|dispneia/,"Pneumologia"],
        [/anemia|hematologia|hemostasia/,"Hematologia"],
        [/cirurgia/,"Cirurgia"],
        [/hipertensao/,"Clínica Médica — Hipertensão"],
        [/glicemia_consciencia|pulso_circulacao/,"Clínica Médica — Semiologia"],
        [/has_dislipidemia/,"Clínica Médica — HAS/Dislipidemia"]
    ];
    function labelFor(file){
        const name=String(file||"").toLowerCase();
        const hit=LABELS.find(([rx])=>rx.test(name));
        if(hit)return hit[1];
        return String(file||"Conhecimento").replace(/^.*\//,"").replace(/\.json$/i,"");
    }
    function ensureStyles(){
        if(document.getElementById("knowledge-status-ui-style"))return;
        const style=document.createElement("style"); style.id="knowledge-status-ui-style";
        style.textContent=".kb-status-list{display:grid;gap:7px}.kb-status-row{display:flex;align-items:center;gap:8px;padding:8px 9px;border:1px solid rgba(52,211,153,.18);background:rgba(52,211,153,.045);border-radius:9px}.kb-status-dot{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#34d399;box-shadow:0 0 9px rgba(52,211,153,.35)}.kb-status-name{font-size:12px;font-weight:750}.kb-status-state{margin-left:auto;color:#9ff4d0;font-size:10px;font-weight:700}.kb-status-meta{margin-top:8px;color:var(--muted);font-size:10px;line-height:1.5}";
        document.head.appendChild(style);
    }
    function escapeHTML(value){
        return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\x27/g,"&#039;");
    }
    function render(engine){
        ensureStyles();
        const root=document.getElementById("knowledgeBaseStatus");
        const summary=document.getElementById("knowledgeBaseSummary");
        const list=document.getElementById("knowledgeBaseStatusList");
        if(!root||!list)return;
        const sources=Array.isArray(engine?.library?.sources)?engine.library.sources:[];
        const cases=Array.isArray(engine?.library?.cases)?engine.library.cases:[];
        const grouped=new Map();
        sources.forEach(file=>{
            const label=labelFor(file);
            if(!grouped.has(label))grouped.set(label,{label,files:[],records:0});
            const item=grouped.get(label);
            item.files.push(file);
            item.records+=cases.filter(c=>String(c?.kb_source||"")===String(file)).length;
        });
        const rows=[...grouped.values()].sort((a,b)=>a.label.localeCompare(b.label,"pt-BR"));
        list.innerHTML=rows.length ? rows.map(item=>
            "<div class=\"kb-status-row\" title=\"" + escapeHTML(item.files.join("
")) + "\">" +
            "<span class=\"kb-status-dot\"></span>" +
            "<span class=\"kb-status-name\">" + escapeHTML(item.label) + "</span>" +
            "<span class=\"kb-status-state\">" + (item.records>0?"CARREGADO":"SEM REGISTROS") + "</span>" +
            "</div>"
        ).join("") : "<div class=\"kb-status-meta\">Nenhuma base clínica carregada.</div>";
        if(summary)summary.textContent=rows.length+" especialidade(s) · "+cases.length+" registro(s)";
    }
    function install(){
        const Engine=global.DiagnosisEngine;
        if(!Engine?.prototype?.boot)return false;
        if(Engine.prototype.__knowledgeStatusWrapped)return true;
        const original=Engine.prototype.boot;
        Engine.prototype.boot=async function(){const result=await original.call(this);render(this);return result;};
        Engine.prototype.__knowledgeStatusWrapped=true;
        return true;
    }
    if(!install()){
        const timer=global.setInterval(()=>{if(install())global.clearInterval(timer);},100);
        global.setTimeout(()=>global.clearInterval(timer),10000);
    }
    global.DiagnosysKnowledgeStatusUI={render};
})(typeof window!=="undefined"?window:globalThis);