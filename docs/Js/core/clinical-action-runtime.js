/* Diagnosis — Phase 1 Action Runtime
 *
 * Loaded after the existing clinical-flow/control extensions.
 * It creates a canonical semantic front door while preserving the final
 * legacy processAction as a fallback/delegation target.
 */
"use strict";
(function(global){
    if(global.__diagnosisPhase1ActionRuntimeInstalled)return;
    global.__diagnosisPhase1ActionRuntimeInstalled=true;

    function install(engine){
        if(!engine||engine.__phase1ActionRuntimeInstalled)return;
        if(typeof global.ClinicalActionResolver!=="function"||typeof global.ClinicalActionDispatcher!=="function")return;
        if(typeof engine.processAction!=="function")return;

        const original=engine.processAction;
        engine.__phase1OriginalProcessAction=original.bind(engine);

        engine.clinicalActionResolver=global.clinicalActionResolver||
            new global.ClinicalActionResolver();

        engine.clinicalIntentRemoteRouter = typeof global.ClinicalIntentRemoteRouter === "function"
            ? new global.ClinicalIntentRemoteRouter()
            : null;

        if(!engine.clinicalInterlocutor&&typeof global.ClinicalInterlocutor==="function"){
            engine.clinicalInterlocutor=new global.ClinicalInterlocutor({
                patientState:engine.patientState||null,
                clinicalModel:engine.clinicalModel||null
            });
        }

        engine.clinicalActionDispatcher=new global.ClinicalActionDispatcher({
            engine,
            resolver:engine.clinicalActionResolver,
            interlocutor:engine.clinicalInterlocutor||null
        });

        engine.resolveClinicalAction=function(text,options){
            return this.clinicalActionResolver.resolve(text,options);
        };

        engine.processAction=async function(input){
            const text=String(input??"").trim();
            if(!text)return this.__phase1OriginalProcessAction(input);

            const resolution=this.clinicalActionResolver.resolve(text);
            this.context=this.context||{};
            this.context.lastActionResolution=resolution;

            this.conversationLogger?.logEvent?.("clinical_action_resolved",{
                input:text,status:resolution.status,intent:resolution.intent,confidence:resolution.confidence
            });

            /* First try the deterministic local resolver. If it cannot
             * resolve the language safely, use UMLS/terminology and then Gemini
             * as a semantic fallback. Neither remote layer executes actions. */
            if(!resolution.recognized && this.clinicalIntentRemoteRouter){
                try{
                    const allowedActions=this.clinicalActionResolver?.registry?.list?.() || [];
                    const remote=await this.clinicalIntentRemoteRouter.resolve(text,{
                        resolver:this.clinicalActionResolver,
                        useGemini:false,
                        allowedActions:allowedActions.map(def=>({
                            id:def.id,
                            domain:def.domain,
                            operation:def.operation,
                            targetType:def.targetType||null
                        }))
                    });

                    if(remote?.recognized){
                        this.context.lastActionResolution=remote;
                        this.conversationLogger?.logEvent?.("clinical_action_remote_resolved",{
                            input:text,
                            source:remote.source,
                            intent:remote.intent,
                            confidence:remote.confidence
                        });

                        const remoteResult=await this.clinicalActionDispatcher.dispatch(text,{resolution:remote});
                        if(remoteResult.handled)return remoteResult;
                    }
                }catch(error){
                    this.conversationLogger?.logEvent?.("clinical_action_remote_error",{
                        input:text,
                        error:error?.message||String(error)
                    });
                }
            }

            /* Non-regression path: unknown language remains handled by legacy code. */
            if(!resolution.recognized&&resolution.status!=="ambiguous")
                return this.__phase1OriginalProcessAction(input);

            if(resolution.status==="ambiguous"){
                this.log?.("AÇÃO","Não consegui determinar com segurança a ação clínica solicitada. Tente especificar o exame, procedimento ou alvo.");
                return {handled:true,status:"ambiguous",resolution};
            }

            const result=await this.clinicalActionDispatcher.dispatch(text,{resolution});

            /* A recognized action without a safe handler is not swallowed. */
            if(!result.handled)return this.__phase1OriginalProcessAction(input);
            return result;

        };

        engine.__phase1ActionRuntimeInstalled=true;
        engine.log?.("SISTEMA","Resolver clínico Fase 1 integrado: linguagem → intenção → ação canônica.");
    }

    function tryInstall(){
        const engine=global.idmtEngine;
        if(!engine)return false;
        install(engine);
        return Boolean(engine.__phase1ActionRuntimeInstalled);
    }

    if(tryInstall())return;
    global.addEventListener("DOMContentLoaded",tryInstall);

    let attempts=0;
    const timer=global.setInterval(()=>{
        attempts++;
        if(tryInstall()||attempts>=40)global.clearInterval(timer);
    },250);
})(typeof window!=="undefined"?window:globalThis);
