/* Phase 1 — Clinical Action Resolver tests */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

const root=path.resolve(__dirname,"..","..");
const context={console,structuredClone};
context.globalThis=context;

for(const file of [
    "docs/Js/core/clinical-action-registry.js",
    "docs/Js/core/clinical-action-parser.js",
    "docs/Js/core/clinical-action-resolver.js"
]){
    vm.runInNewContext(fs.readFileSync(path.join(root,file),"utf8"),context,{filename:file});
}

const resolver=new context.ClinicalActionResolver();
const cases=[
    ["solicito um ECG","request_investigation","ecg"],
    ["quero uma gasometria arterial","request_investigation","blood_gas"],
    ["cheque a pressão arterial","request_vitals","blood_pressure"],
    ["verifique a glicemia","request_vitals","glucose"],
    ["faça o exame cardiovascular","request_physical_exam","cardiovascular"],
    ["pergunte quando começaram os sintomas","request_history","onset"],
    ["vou iniciar monitorização","activate_monitoring",null],
    ["minha hipótese é crise adrenal","record_diagnosis_hypothesis",null],
    ["explique a fisiopatologia da crise adrenal","request_knowledge",null],
    ["não solicito ECG","request_investigation","ecg"],
    ["já solicitei o ECG","request_investigation","ecg"],
    ["reavalie os sinais vitais","request_reassessment",null]
];

for(const [text,intent,target] of cases){
    const result=resolver.resolve(text);
    assert.equal(result.recognized,true,"Não reconheceu: "+text);
    assert.equal(result.intent,intent,"Intent incorreta: "+text);
    if(target)assert.equal(result.action?.target?.id,target,"Target incorreto: "+text);
}

assert.equal(resolver.resolve("não solicito ECG").action.negated,true);
assert.equal(resolver.resolve("já solicitei o ECG").action.temporality,"past");

const unknown=resolver.resolve("o paciente está estranho");
assert.equal(unknown.recognized,false);

const multi=resolver.resolve("solicito ECG e depois reavalio os sinais vitais");
assert.equal(multi.actions.length>=2,true);

assert.equal(resolver.resolve("vou iniciar tratamento").intent,"record_treatment");

console.log("Phase 1 Clinical Action Resolver: OK");
console.log("Testes executados:",cases.length+5);
