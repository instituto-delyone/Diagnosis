/* Diagnosis — Phase 1 Clinical Action Dispatcher */
"use strict";
(function(global){
    class ClinicalActionDispatcher{
        constructor(options={}){
            this.engine=options.engine||null;
            this.resolver=options.resolver||global.clinicalActionResolver||null;
            this.interlocutor=options.interlocutor||null;
            this.minConfidence=Number(options.minConfidence||.62);
        }
        attach(engine){this.engine=engine;return this;}
        resolve(text){return this.resolver?this.resolver.resolve(text):null;}
        getInterlocutor(){
            const e=this.engine;
            if(e?.clinicalInterlocutor){
                e.clinicalInterlocutor.patientState=e.patientState||null;
                e.clinicalInterlocutor.clinicalModel=e.clinicalModel||e.clinicalInterlocutor.clinicalModel;
                return e.clinicalInterlocutor;
            }
            if(typeof global.ClinicalInterlocutor==="function"){
                this.interlocutor=this.interlocutor||new global.ClinicalInterlocutor();
                this.interlocutor.patientState=e?.patientState||null;
                this.interlocutor.clinicalModel=e?.clinicalModel||null;
                return this.interlocutor;
            }
            return this.interlocutor||null;
        }
        async dispatch(text,options={}){
            const resolution=options.resolution||this.resolve(text);
            if(!resolution)return {handled:false,status:"resolver_unavailable",resolution:null};
            if(resolution.status==="ambiguous"){
                this.engine?.log?.("AÇÃO","Não consegui determinar com segurança qual ação clínica foi solicitada. Especifique o procedimento, exame ou alvo.");
                return {handled:true,status:"ambiguous",resolution};
            }
            if(!resolution.recognized||resolution.confidence<this.minConfidence)return {handled:false,status:"unknown_or_low_confidence",resolution};
            if(resolution.actions.length>1){
                const results=[];
                for(const action of resolution.actions)results.push(await this.dispatchAction(action,text,resolution));
                return {handled:results.some(x=>x.handled),status:"multi_action",resolution,results};
            }
            return this.dispatchAction(resolution.action,text,resolution);
        }
        async dispatchAction(action,text,resolution){
            const e=this.engine;if(!action)return {handled:false,status:"no_action",resolution};
            if(action.negated){
                e?.log?.("AÇÃO","Ação reconhecida, mas explicitamente negada: "+text);
                return {handled:true,status:"negated",resolution,action};
            }
            if(action.temporality==="past"){
                e?.context?.history?.push({type:"historical_action",action:action.id,target:action.target?.canonical||null,text,timestamp:Date.now()});
                e?.log?.("AÇÃO","Ação histórica reconhecida: "+text);
                return {handled:true,status:"historical",resolution,action};
            }
            const interlocutor=this.getInterlocutor();
            if(action.domain==="assessment"||action.domain==="investigation"||action.domain==="knowledge"){
                if(interlocutor?.interpret){
                    const interpreted=interlocutor.interpret(text);
                    return {handled:true,status:"interpreted",resolution,action,interpreted};
                }
            }
            if(action.domain==="diagnosis"&&typeof e?.submitDiagnosis==="function"&&action.operation==="record"){
                const etiologic=document.getElementById("etiologicDiagnosisInput");
                const syndromic=document.getElementById("syndromicDiagnosisInput");
                const input=etiologic||syndromic;
                if(input){
                    input.value=action.target?.canonical||text;
                    e.submitDiagnosis(etiologic?"etiologic":"syndromic");
                    return {handled:true,status:"diagnosis_recorded",resolution,action};
                }
            }
            if(action.domain==="monitoring"&&typeof e?.activateMonitoring==="function"){
                e.activateMonitoring();
                return {handled:true,status:"monitoring_activated",resolution,action};
            }
            if(["treatment","procedure","disposition"].includes(action.domain)&&typeof e?.__phase1OriginalProcessAction==="function"){
                const result=await e.__phase1OriginalProcessAction(text);
                return {handled:true,status:"delegated_to_engine",resolution,action,result};
            }
            return {handled:false,status:"no_handler",resolution,action};
        }
    }
    global.ClinicalActionDispatcher=ClinicalActionDispatcher;
})(typeof window!=="undefined"?window:globalThis);
