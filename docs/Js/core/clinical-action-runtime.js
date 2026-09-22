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

            /* Non-regression path: unknown language remains handled by legacy code. */
            if(!resolution.recognized&&resolution.status!=="ambiguous")
                return this.__phase1OriginalProcessAction(input);

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
