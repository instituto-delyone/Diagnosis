"use strict";
(function(w){
var MAP_PATH="knowledge_base/clinical_knowledge_map.json";
var KB_BASE="knowledge_base/";
var N=function(v){return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\\s]/g," ").replace(/\\s+/g," ").trim()};
var P=[
["hepatite viral A",18,35,"hepato","viagem/exposição alimentar ou infecciosa","Estou ficando amarelo."],
["hepatite viral B",25,50,"hepato","exposição sexual ou sanguínea","Percebi que estou amarelo."],
["hepatite viral D",25,50,"hepato","contexto epidemiológico para hepatite viral","Notei icterícia."],
["hepatite alcoólica",40,60,"hepato","consumo crônico de álcool","Estou ficando amarelo e me sentindo mal."],
["cirrose",45,70,"cirrose","doença hepática crônica prévia","Percebi que fiquei amarelo."],
["esteato-hepatite não alcoólica",40,65,"hepato","contexto metabólico","Minha pele ficou amarelada."],
["doença de Wilson",12,30,"hepato","história familiar","Estou ficando amarelo."],
["hepatite autoimune",20,55,"hepato","contexto de doença autoimune","Estou com icterícia."],
["CMV",18,45,"hepato","exposição infecciosa","Estou amarelo e indisposto."],
["EBV",15,35,"hepato","exposição infecciosa","Estou amarelo e cansado."],
["HSV",18,45,"hepato","contexto infeccioso","Minha pele ficou amarelada."],
["colangite biliar primária",40,65,"colest","contexto autoimune","Estou amarelo e com muita coceira."],
["colangite esclerosante primária",25,55,"colest","contexto inflamatório intestinal","Estou amarelo e com coceira."],
["coledocolitíase",30,70,"obstr","história de doença biliar","Estou amarelo e com dor do lado direito."],
["colangiocarcinoma",55,80,"obstr","doença biliar prévia","Estou ficando cada vez mais amarelo."],
["câncer de cabeça de pâncreas",55,80,"obstr","contexto de risco","Estou amarelo e emagrecendo."],
["pancreatite",30,65,"obstr","doença biliar ou exposição relevante","Estou amarelo e com dor abdominal."],
["síndrome de Gilbert",15,30,"indireta","história familiar","Às vezes meus olhos ficam amarelos."],
["Crigler-Najjar",1,25,"indireta","história familiar","Tenho episódios de pele amarelada."],
["anemia hemolítica",18,70,"indireta","contexto de hemólise","Estou amarelo e muito cansado."]
];
var pick=function(a){return a[Math.floor(Math.random()*a.length)]};
var esc=function(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")};

function E(){this.kb=null;this.map=null;this.knowledge={};this.c=null;this.rev={};this.logs=[];this.score=0;this.lock=false;this.e={}}

E.prototype.boot=async function(){
 var s=this,ids="fc rr spo2 pa temp glucose ecgLiveLabel ecgFooterRate stabilityText stabilityBar score difficultyLabel stateStatus roomLabel roomLabelMeta difficultyLabelMeta caseTitle caseIntro clinicalLog actionInput sendBtn hintBtn endCaseBtn nextBtn conversationLogDownload stateList knowledgeBaseStatusList knowledgeBaseSummary investigationCatalog diagnosisInput diagnosisSubmit diagnosisStatus".split(" ");
 ids.forEach(function(i){s.e[i]=document.getElementById(i)});
 this.bind();
 try{
   var map=await this.loadJSON(MAP_PATH);
   this.map=map;
   var m=map.modules.CM01;
   if(!m)throw Error("CM01 não está no mapa clínico.");
   var paths=Object.keys(m).filter(function(k){return k!=="syndrome"});
   for(var i=0;i<paths.length;i++)s.knowledge[paths[i]]=await s.loadJSON(KB_BASE+m[paths[i]].replace(/^knowledge_base\//,""));
   s.kb=await s.loadJSON(m.knowledge_base.replace(/^knowledge_base\//,""));
   s.kbStatus(1,"CM01 + anamnese + exame físico + exames complementares");
   await this.newCase();
 }catch(x){this.kbStatus(0,x.message);this.status("ERRO");this.log("ERRO","Falha na rota clínica: "+x.message)}
};

E.prototype.loadJSON=async function(path){
 var r=await fetch(path,{cache:"no-store"});
 if(!r.ok)throw Error(path+" HTTP "+r.status);
 return await r.json();
};

E.prototype.bind=function(){var s=this;
 this.e.sendBtn.onclick=function(){s.input()};
 this.e.actionInput.onkeydown=function(e){if(e.key==="Enter"){e.preventDefault();s.input()}};
 this.e.hintBtn.onclick=function(){s.hint()};
 this.e.nextBtn.onclick=function(){s.newCase()};
 this.e.endCaseBtn.onclick=function(){s.finish()};
 this.e.diagnosisSubmit.onclick=function(){s.diagnose()};
 this.e.diagnosisInput.onkeydown=function(e){if(e.key==="Enter"){e.preventDefault();s.diagnose()}};
 this.e.conversationLogDownload.onclick=function(){s.download()}
};

E.prototype.newCase=async function(){
 if(!this.kb)return;
 this.rev={};this.logs=[];this.score=0;this.lock=0;
 var p=pick(P),age=p[1]+Math.floor(Math.random()*(p[2]-p[1]+1)),sex=pick(["feminino","masculino"]);
 var ini=pick(["ANA","BRU","CAI","DAV","ELI","FEL","GAB","HEL","IGO","JOA","LUC","MAR","NIC","PAU","RAF","SAR","TIA","VAL","YUR"]);
 this.c={id:"cm01_"+Date.now().toString(36),p:p,patient:{initials:ini,age:age,sex:sex},opening:p[5],risk:p[4],history:this.makeHistory(p),physical:this.makePhysical(p),exams:[]};
 this.c.exams=this.makeExams(p);
 this.render();this.log("SISTEMA","CM01 → KB + anamnese + exame físico + exames complementares → paciente.");
 this.log("PACIENTE",ini+", "+age+" anos, "+sex+". "+p[5]);
 this.log("SISTEMA","A patologia está oculta. Pergunte, examine e solicite exames.");
};

E.prototype.makeHistory=function(p){
 var d=(p[3]==="indireta"||p[0]==="cirrose")?"há meses/anos":"há "+pick(["3 dias","7 dias","10 dias","2 semanas"]);
 return {
   duration:d,
   abdominalPain:p[3]==="obstr"||p[0]==="pancreatite",
   alcohol:p[0]==="hepatite alcoólica",
   sexualRisk:p[0]==="hepatite viral B"||p[0]==="hepatite viral D",
   autoimmune:p[0]==="hepatite autoimune"||p[0]==="colangite biliar primária",
   otherDisease:p[0]==="cirrose"?"doença hepática crônica prévia":(p[0]==="colangite esclerosante primária"?"doença inflamatória intestinal":null),
   fever:p[0]==="pancreatite"||p[0]==="CMV"||p[0]==="EBV",
   pruritus:p[3]==="colest",
   urineStool:p[3]==="obstr"||p[3]==="colest"
 };
};

E.prototype.makePhysical=function(p){
 var items=this.knowledge.exame_fisico&&this.knowledge.exame_fisico.items||[];
 var f={general:"estável",ictericia:true,hepatomegaly:false,splenomegaly:false,ascites:false,rqPain:p[3]==="obstr"||p[0]==="pancreatite",lymphNodes:false,jugularCongestion:false,gallbladderPalpable:false};
 if(p[0]==="cirrose"){f.hepatomegaly=true;f.splenomegaly=true;f.ascites=true}
 return {source_items:items,findings:f};
};

E.prototype.makeExams=function(p){
 var defs=(this.knowledge.exames_complementares&&this.knowledge.exames_complementares.exams)||[];
 return defs.map(function(d){return{id:d.id,name:d.name,result:(d.result_by_pattern[p[3]]||d.result_by_pattern[p[0]]||d.result_by_pattern.default||"Resultado não definido para este padrão.")}}); 
};

E.prototype.render=function(){var c=this.c,v={HR:"82 bpm",RR:"16 irpm",SpO2:"98%",BP:"118/76 mmHg",temperature:"36.7 °C",glucose:"96 mg/dL"},r=82;
 this.txt("roomLabel","CLÍNICA · TÚNEL");this.txt("roomLabelMeta","CLÍNICA · TÚNEL");this.txt("caseTitle","Paciente "+c.patient.initials);
 this.txt("caseIntro",c.patient.age+" anos, "+c.patient.sex+". "+c.opening);
 this.txt("difficultyLabel","EXPERIMENTAL");this.txt("difficultyLabelMeta","EXPERIMENTAL");
 this.txt("fc",v.HR);this.txt("rr",v.RR);this.txt("spo2",v.SpO2);this.txt("pa",v.BP);this.txt("temp",v.temperature);this.txt("glucose",v.glucose);
 this.txt("ecgLiveLabel","LIVE · "+r+" BPM");this.txt("ecgFooterRate","FC "+r+" bpm");this.ecg(r);this.renderExams();this.state();
 this.e.diagnosisInput.value="";this.txt("diagnosisStatus","Hipótese ainda não fixada.")
};

E.prototype.ecg=function(r){var q=document.getElementById("ecgSignalPath");if(!q)return;var rr=60000/r,d=rr*5,g=function(t,c,w,a){return a*Math.exp(-.5*Math.pow((t-c)/(w/2.355),2))},a=[];
 for(var t=0;t<=d;t+=8){var p=((t%rr)+rr)%rr,y=66-(g(p,120,75,.13)+g(p,182,16,-.16)+g(p,200,13,1.05)+g(p,218,16,-.32)+g(p,390,125,.30))*31;a.push((a.length?"L":"M")+(t/d*2400).toFixed(1)+" "+y.toFixed(1))}q.setAttribute("d",a.join(" "))
};

E.prototype.renderExams=function(){var s=this;this.e.investigationCatalog.innerHTML=this.c.exams.map(function(x){return'<button class="investigation-chip '+(s.rev[x.id]?"performed":"")+'" data-id="'+x.id+'"><span>'+esc(x.name)+'</span><small>'+(s.rev[x.id]?"resultado revelado":"pedir")+"</small></button>"}).join("");
 this.e.investigationCatalog.querySelectorAll("[data-id]").forEach(function(b){b.onclick=function(){s.exam(b.dataset.id)}})
};

E.prototype.exam=function(id){var x=this.c.exams.find(function(z){return z.id===id});if(!x)return;if(!this.rev[id]){this.rev[id]=1;this.score+=5;this.log("EXAME",x.name+": "+x.result)}this.renderExams();this.state()};

E.prototype.input=function(){
 var v=this.e.actionInput.value.trim();if(!v||!this.c)return;this.e.actionInput.value="";this.log("VOCÊ",v);
 var n=N(v),s=this;
 if(/^(hepatite|cirrose|colangite|coledocolitiase|coledocolitíase|pancreatite|cancer|câncer|sindrome|síndrome|anemia|cmv|ebv|hsv)/.test(n)&&!/qual|como|o que|por que|porque/.test(n)){this.log("SISTEMA","Hipótese clínica registrada como raciocínio. Use o campo Diagnóstico para fixá-la.");return}
 var x=this.c.exams.find(function(z){return n.includes(N(z.name))||N(z.name).split(" ").some(function(t){return t.length>3&&n.includes(t)})});
 if(x&&/pedir|solicitar|solicito|gostaria|quero|peco|peco|exame|lab|ultrassom|usg/.test(n)){this.exam(x.id);return}
 var a=this.answerHistory(n);if(a!==null){this.log("PACIENTE",a);return}
 var f=this.answerPhysical(n);if(f!==null){this.log("EXAME FÍSICO",f);return}
 if(/tratamento|tratar|conduta|manejo/.test(n)){this.log("SISTEMA","Conduta não está sendo construída nesta etapa do túnel.");return}
 if(/erro|errado|não avalia|nao avalia|isso esta errado|isso está errado/.test(n)){this.log("SISTEMA","Observação registrada. A rota clínica agora mantém exame e resultado separados.");return}
 this.log("SISTEMA","Pergunta ainda não coberta. Isso é proposital: agora sabemos exatamente onde conectar o próximo componente.")
};

E.prototype.answerHistory=function(n){
 var h=this.c.history;
 if(/idade|anos|quantos anos/.test(n))return"Tenho "+this.c.patient.age+" anos.";
 if(/sexo|homem|mulher/.test(n))return"Sou do sexo "+this.c.patient.sex+".";
 if(/quanto tempo|há quanto|quando começou|inicio|início|evolucao|evolução/.test(n))return"A icterícia começou "+h.duration+".";
 if(/alcool|álcool|etilista|bebe|bebe alcool|consome alcool/.test(n))return h.alcohol?"Sim. Tenho consumo crônico de álcool.":"Não há consumo crônico de álcool relevante informado neste caso.";
 if(/relac|sexual|desprotegida|desprotegido/.test(n))return h.sexualRisk?"Sim, há antecedente de exposição sexual de risco relevante.":"Nega exposição sexual de risco relevante.";
 if(/autoimune|autoimunidade/.test(n))return h.autoimmune?"Sim, há contexto de doença autoimune.":"Não há doença autoimune conhecida.";
 if(/outra doença|comorbidade|antecedente|doenca previa|doença prévia/.test(n))return h.otherDisease?"Há "+h.otherDisease+".":"Não há outra doença relevante informada.";
 if(/febre|calafrio/.test(n))return h.fever?"Sim, há febre/calafrios no quadro.":"Não há febre ou calafrios.";
 if(/prurido|coceira/.test(n))return h.pruritus?"Sim, há prurido.":"Não há prurido como sintoma predominante.";
 if(/urina|coluria|colúria|fezes|acolia/.test(n))return h.urineStool?"Há alteração urinária/fecal compatível com o padrão ictérico.":"Não há alteração urinária/fecal relevante informada.";
 if(/dor|abdominal|hipocondrio|hipocôndrio/.test(n))return h.abdominalPain?"Sim, há dor abdominal, predominando no hipocôndrio direito.":"Não há dor abdominal como sintoma principal.";
 if(/queixa|sintoma principal|o que sente|sentindo/.test(n))return this.c.opening;
 return null
};

E.prototype.answerPhysical=function(n){
 var f=this.c.physical.findings;
 if(/exame fisico|exame físico|ao exame|examine|ectoscopia|como esta o exame|como está o exame/.test(n)){
   return "Exame físico dirigido: "+(f.ictericia?"icterícia escleral":"sem icterícia escleral")+", "+(f.hepatomegaly?"hepatomegalia":"sem hepatomegalia evidente")+", "+(f.splenomegaly?"esplenomegalia":"sem esplenomegalia evidente")+", "+(f.ascites?"ascite":"sem ascite evidente")+", "+(f.rqPain?"dor à palpação em hipocôndrio direito":"sem dor importante à palpação em hipocôndrio direito")+".";
 }
 if(/hepatomegalia|fígado aumentado|figado aumentado|hepatimetria/.test(n))return f.hepatomegaly?"Há hepatomegalia ao exame.":"Não há hepatomegalia evidente.";
 if(/esplenomegalia|baço aumentado|baco aumentado/.test(n))return f.splenomegaly?"Há esplenomegalia ao exame.":"Não há esplenomegalia evidente.";
 if(/ascite/.test(n))return f.ascites?"Há sinais de ascite.":"Não há sinais de ascite.";
 if(/courvoisier|vesicula palpavel|vesícula palpável/.test(n))return f.gallbladderPalpable?"Vesícula palpável, conforme o estado do paciente.":"Vesícula não palpável.";
 if(/linfonodo|linfonodomegalia/.test(n))return f.lymphNodes?"Há linfonodomegalias.":"Não há linfonodomegalias evidentes.";
 return null
};

E.prototype.diagnose=function(){if(this.lock)return;var v=this.e.diagnosisInput.value.trim();if(!v)return;this.lock=1;var a=N(v).split(" ").filter(Boolean),b=N(this.c.p[0]).split(" ").filter(Boolean),i=a.filter(function(x){return b.includes(x)}).length,u=new Set(a.concat(b)).size,s=u?i/u:0;this.score+=Math.round(s*50);this.txt("diagnosisStatus","Hipótese registrada · proximidade "+Math.round(s*100)+"%.");this.log("AVALIAÇÃO",s>=.55?"Hipótese coerente com a verdade clínica.":"Hipótese registrada; verdade clínica no encerramento.");this.state()};

E.prototype.hint=function(){this.score=Math.max(0,this.score-2);this.log("DICA","Comece pela síndrome ictérica, determine o padrão de bilirrubina e de lesão e use a história e o exame físico para discriminar as possibilidades.");this.state()};
E.prototype.finish=function(){this.log("RESULTADO","Verdade clínica: "+this.c.p[0]+". Pontuação: "+this.score+".");this.status("ENCERRADO")};
E.prototype.state=function(){this.txt("score",this.score);this.txt("stabilityText","100%");this.e.stabilityBar.style.width="100%";this.e.stateList.innerHTML='<li><span class="state-key">Estabilidade</span><span class="state-value">100%</span></li><li><span class="state-key">Exames revelados</span><span class="state-value">'+Object.keys(this.rev).length+'</span></li><li><span class="state-key">Diagnóstico</span><span class="state-value">'+(this.lock?"Hipótese fixada":"Não estabelecido")+"</span></li>"};
E.prototype.kbStatus=function(ok,msg){this.e.knowledgeBaseStatusList.innerHTML='<div class="kb-row"><span class="kb-dot '+(ok?"ok":"")+'"></span><strong>CM01</strong><span>'+(ok?"ATIVO":"ERRO")+"</span></div>";this.txt("knowledgeBaseSummary",msg)};
E.prototype.status=function(v){this.txt("stateStatus",v)};E.prototype.txt=function(id,v){if(this.e[id])this.e[id].textContent=v};
E.prototype.log=function(t,m){this.logs.push({time:new Date().toISOString(),type:t,text:m});var d=document.createElement("div");d.className="log-entry "+(t==="VOCÊ"?"user":t==="ERRO"?"danger":t==="RESULTADO"||t==="AVALIAÇÃO"?"success":"system");d.innerHTML="<strong>"+esc(t)+"</strong><br>"+esc(m);this.e.clinicalLog.appendChild(d);this.e.clinicalLog.scrollTop=this.e.clinicalLog.scrollHeight};
E.prototype.download=function(){var b=new Blob([JSON.stringify({case_id:this.c&&this.c.id,patient:this.c&&this.c.patient,history:this.logs},null,2)],{type:"application/json"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;var x=document.createElement("a");x.href=u;x.download="diagnosys-tunnel-log.json";x.click();URL.revokeObjectURL(u)};
w.DiagnosisTunnelEngine=E;w.DiagnosisTunnel=new E();document.addEventListener("DOMContentLoaded",function(){w.DiagnosisTunnel.boot()});
})(window);