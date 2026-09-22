/* Diagnosis — Phase 1 Clinical Action Registry */
"use strict";
(function(global){
    const ACTION_REGISTRY = [
        {
            id:"request_vitals", domain:"assessment", operation:"request", targetType:"vital_sign",
            aliases:["sinais vitais","parametros vitais","ver os sinais vitais","checar os sinais vitais","aferir os sinais vitais","medir os sinais vitais","verificar os sinais vitais","vital signs"],
            targets:{
                all:{canonical:"all_vitals",aliases:["sinais vitais","parametros vitais"]},
                heart_rate:{canonical:"heart_rate",aliases:["frequencia cardiaca","fc","pulso","batimentos","batimentos cardiacos"]},
                respiratory_rate:{canonical:"respiratory_rate",aliases:["frequencia respiratoria","fr","frequencia de respiracoes","respiracoes por minuto"]},
                blood_pressure:{canonical:"blood_pressure",aliases:["pressao arterial","pa","pressao"]},
                spo2:{canonical:"spo2",aliases:["saturacao","spo2","spo 2","saturacao de oxigenio","oximetria"]},
                temperature:{canonical:"temperature",aliases:["temperatura","temperatura corporal"]},
                glucose:{canonical:"glucose",aliases:["glicemia","glicose","glicemia capilar","dextro"]}
            }
        },
        {
            id:"request_history",domain:"assessment",operation:"request",targetType:"history",
            aliases:["anamnese","historia clinica","historia medica","historia pregressa","antecedentes","historico","perguntar antecedentes","colher historia"],
            targets:{
                chief_complaint:{canonical:"chief_complaint",aliases:["queixa principal","motivo da consulta","motivo da procura"]},
                onset:{canonical:"onset",aliases:["inicio dos sintomas","quando comecou","quando iniciou","quando comecaram os sintomas","ha quanto tempo"]},
                pain:{canonical:"pain",aliases:["dor","caracteristica da dor","historia da dor","onde doi"]},
                fever:{canonical:"fever",aliases:["febre","calafrios","calafrio"]},
                medications:{canonical:"medications",aliases:["medicamentos","medicacoes","remedios","uso de medicamentos"]},
                history:{canonical:"history",aliases:["antecedentes","historia pregressa","historico medico"]}
            }
        },
        {
            id:"request_physical_exam",domain:"assessment",operation:"request",targetType:"physical_exam",
            aliases:["exame fisico","examinar","examine o paciente","avaliar o paciente","fazer exame fisico","realizar exame fisico"],
            targets:{
                general:{canonical:"general",aliases:["exame fisico geral","estado geral","aspecto geral"]},
                cardiovascular:{canonical:"cardiovascular",aliases:["exame cardiovascular","exame cardiologico","avaliacao cardiovascular","ausculta cardiaca","bulhas cardiacas"]},
                respiratory:{canonical:"respiratory",aliases:["exame respiratorio","avaliacao respiratoria","ausculta pulmonar","ausculta respiratoria","murmurio vesicular","sons respiratorios"]},
                neurologic:{canonical:"neurologic",aliases:["exame neurologico","avaliacao neurologica","estado neurologico"]},
                abdomen:{canonical:"abdomen",aliases:["exame abdominal","exame do abdomen","palpacao abdominal"]},
                extremities:{canonical:"extremities",aliases:["exame dos membros","membros","extremidades","pulsos perifericos"]}
            }
        },
        {
            id:"request_investigation",domain:"investigation",operation:"request",targetType:"investigation",
            aliases:["solicitar exame","pedir exame","solicito exame","quero um exame","fazer exame","realizar exame","colher exame","investigar"],
            targets:{
                ecg:{canonical:"ecg",aliases:["ecg","eletro","eletrocardiograma","eletrocardiografia"]},
                blood_gas:{canonical:"blood_gas",aliases:["gasometria","gasometria arterial","gasometria venosa","gasometria de sangue"]},
                hemogram:{canonical:"hemogram",aliases:["hemograma","hemograma completo","cbc"]},
                laboratory:{canonical:"laboratory",aliases:["exames laboratoriais","laboratorio","labs","laboratorio completo","painel laboratorial"]},
                ct:{canonical:"ct",aliases:["tomografia","tc","ct","tomografia computadorizada"]},
                chest_xray:{canonical:"chest_xray",aliases:["raio x","raio-x","rx","rx de torax","radiografia de torax","radiografia toracica"]}
            }
        },
        {
            id:"record_diagnosis_hypothesis",domain:"diagnosis",operation:"record",targetType:"diagnosis",
            aliases:["minha hipotese e","minha principal hipotese e","hipotese diagnostica","diagnostico mais provavel","acredito que seja","penso em","considero","minha impressao diagnostica"]
        },
        {
            id:"request_knowledge",domain:"knowledge",operation:"query",targetType:"concept",
            aliases:["o que e","explique","me explique","conceito de","definicao de","fisiopatologia","etiologia","apresentacao clinica","achados clinicos","sinais e sintomas de","sintomas de","diagnostico de","como e feito o diagnostico de","tratamento de","manejo de","prognostico de"]
        },
        {
            id:"record_treatment",domain:"treatment",operation:"record",targetType:"treatment",
            aliases:["tratar","tratamento","conduta","manejo","prescrever","prescricao","administrar","iniciar","dar","repor","transfundir","oxigenar","hidratar","antibiotico","anticoagular","trombolisar","intubar","ventilar"]
        },
        {
            id:"request_reassessment",domain:"assessment",operation:"request",targetType:"reassessment",
            aliases:["reavaliar","reavalie","reavaliacao","reavalie o paciente","reavaliar paciente","repetir sinais vitais","reavaliar sinais vitais","reavalie os sinais vitais","nova avaliacao","rechecar","checar novamente","repetir avaliacao"]
        },
        {
            id:"activate_monitoring",domain:"monitoring",operation:"activate",targetType:"monitoring",
            aliases:["monitorizar","monitorar","iniciar monitorizacao","iniciar monitoramento","colocar em monitorizacao","colocar em monitoramento"]
        },
        {
            id:"request_disposition",domain:"disposition",operation:"request",targetType:"disposition",
            aliases:["internar","internacao","admitir","admissao hospitalar","alta","dar alta","transferir","transferencia","encaminhar"]
        },
        {
            id:"request_procedure",domain:"procedure",operation:"perform",targetType:"procedure",
            aliases:["procedimento","realizar procedimento","fazer procedimento","puncionar","puncao","acesso venoso","cateter","drenagem","intubacao","intubar"]
        }
    ];
    const clone=v=>typeof structuredClone==="function"?structuredClone(v):JSON.parse(JSON.stringify(v));
    class ClinicalActionRegistry{
        constructor(definitions=ACTION_REGISTRY){
            this.definitions=clone(definitions);
            this.byId=new Map(this.definitions.map(d=>[d.id,d]));
            this.aliasIndex=new Map(); this.targetIndex=new Map(); this.buildIndexes();
        }
        normalize(v){
            return String(v??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
                .replace(/[^\p{L}\p{N}\s+./-]/gu," ").replace(/\s+/g," ").trim();
        }
        buildIndexes(){
            for(const d of this.definitions){
                for(const alias of [d.id,...(Array.isArray(d.aliases)?d.aliases:[])]){
                    const n=this.normalize(alias); if(!n)continue;
                    if(!this.aliasIndex.has(n))this.aliasIndex.set(n,[]); this.aliasIndex.get(n).push(d.id);
                }
                for(const [targetId,target] of Object.entries(d.targets||{})){
                    for(const alias of [targetId,target.canonical,...(Array.isArray(target.aliases)?target.aliases:[])]){
                        const n=this.normalize(alias); if(!n)continue;
                        if(!this.targetIndex.has(n))this.targetIndex.set(n,[]);
                        this.targetIndex.get(n).push({actionId:d.id,targetId,target});
                    }
                }
            }
        }
        get(id){return this.byId.get(id)||null;}
        list(){return clone(this.definitions);}
        findTargetCandidates(text,actionId=null){
            const n=this.normalize(text),out=[];
            for(const [alias,records] of this.targetIndex){
                const escaped=alias.replace(/[.*+?^\$\{\}()|[\]\\]/g,"\\$&");
                const match=alias.length<=3?new RegExp("(^|\\s)"+escaped+"(?=\\s|$)","i").test(n):n.includes(alias);
                if(!match)continue;
                for(const r of records)if(!actionId||r.actionId===actionId)
                    out.push({...r,matchedAlias:alias,lexicalScore:alias.length+(alias===n?1000:0)});
            }
            return out;
        }
    }
    global.ClinicalActionRegistry=ClinicalActionRegistry;
    global.DIAGNOSIS_CLINICAL_ACTION_REGISTRY=clone(ACTION_REGISTRY);
})(typeof window!=="undefined"?window:globalThis);
