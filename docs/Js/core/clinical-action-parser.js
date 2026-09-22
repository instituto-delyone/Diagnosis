/* Diagnosis — Phase 1 Clinical Action Parser */
"use strict";
(function(global){
    class ClinicalActionParser{
        constructor(options={}){
            this.maxClauses=Number(options.maxClauses||8);
            this.negationPatterns=[
                /\bnao\b/,/\bnao quero\b/,/\bnao vou\b/,/\bnao pretendo\b/,
                /\bsem\b/,/\bdispenso\b/,/\bnao realizar\b/,/\bnao solicitar\b/,/\bnao administrar\b/
            ];
            this.pastPatterns=[
                /\bja\b/,/\bfoi realizado\b/,/\bfoi solicitado\b/,/\bja solicitei\b/,
                /\bja fiz\b/,/\bja foi feito\b/,/\brealizado anteriormente\b/
            ];
            this.futurePatterns=[/\bvou\b/,/\bpretendo\b/,/\bplanejo\b/,/\birei\b/,/\bdevo\b/,/\bvamos\b/];
            this.questionPatterns=[
                /\?$/, /^(o que|como|qual|quando|onde|por que|porque|posso|devo|seria|vale a pena)\b/,
                /\bposso\b/,/\bdevo\b/,/\bcomo devo\b/
            ];
        }
        normalize(v){
            return String(v??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
                .replace(/[^\p{L}\p{N}\s+./-]/gu," ").replace(/\s+/g," ").trim();
        }
        tokens(v){return this.normalize(v).split(" ").filter(Boolean);}
        splitClauses(original){
            const source=String(original??"").trim(); if(!source)return [];
            return source
                .replace(/\s+(?:e depois|e entao|e também|e tambem|depois)\s+/gi,";")
                .replace(/\s*;\s*/g,";")
                .replace(/\s*,\s*(?=(?:solicito|peco|peço|quero|vou|inicio|iniciar|administro|dou|reavalio|reavaliar|considero|penso|acredito|prescrevo|prescrever)\b)/gi,";")
                .split(";").map(v=>v.trim()).filter(Boolean).slice(0,this.maxClauses);
        }
        detectNegation(text){
            const n=this.normalize(text),hits=this.negationPatterns.filter(p=>p.test(n)).map(p=>p.source);
            return {negated:hits.length>0,cues:hits};
        }
        detectTemporality(text){
            const n=this.normalize(text);
            if(this.pastPatterns.some(p=>p.test(n)))return "past";
            if(this.futurePatterns.some(p=>p.test(n)))return "future";
            return "current";
        }
        detectQuestion(text){
            const original=String(text??"").trim(),n=this.normalize(original);
            return this.questionPatterns.some(p=>p.test(n)||p.test(original));
        }
        detectSpeechAct(text){
            const n=this.normalize(text);
            if(this.detectQuestion(text))return "question";
            if(/^(solicito|peco|quero|gostaria|favor|pergunte|perguntar|faca|fazer|cheque|verifique|aferir|afira|meca|avalie|examine|realize|realizar|colha|colher)\b/.test(n))return "request";
            if(/^(vou|irei|pretendo|planejo|inicio|iniciar|administro|prescrevo|reavalio|realizo|realizar)\b/.test(n))return "declarative_action";
            if(/^(considero|penso|acredito|minha hipotese|minha impressao)\b/.test(n))return "hypothesis";
            return "declarative";
        }
        extractVerbCandidates(text){
            const n=this.normalize(text);
            const verbs=[
                "solicitar","solicito","solicitei","solicitou","peco","peço","pedi","quero","fazer","faca",
                "realizar","colher","perguntar","pergunte","avaliar","avalie","examinar","examino","examine",
                "checar","cheque","verificar","verifique","aferir","afira","medir","meca","reavaliar","reavalie",
                "monitorizar","monitorar","iniciar","administrar","administro","prescrever","prescrevo","indicar",
                "indico","tratar","repor","transfundir","intubar","ventilar","internar","transferir","encaminhar",
                "considerar","considero","pensar","acreditar"
            ];
            return verbs.filter(v=>new RegExp("\\b"+v+"\\b","i").test(n));
        }
        parseClause(clause,index=0){
            const original=String(clause??"").trim(),normalized=this.normalize(original);
            return {
                index,original,normalized,tokens:this.tokens(normalized),
                speechAct:this.detectSpeechAct(original),
                question:this.detectQuestion(original),
                temporality:this.detectTemporality(original),
                negation:this.detectNegation(normalized),
                verbs:this.extractVerbCandidates(normalized)
            };
        }
        parse(text){
            const original=String(text??"").trim(),clauses=this.splitClauses(original).map((c,i)=>this.parseClause(c,i));
            return {original,normalized:this.normalize(original),clauses,clauseCount:clauses.length,empty:!original};
        }
    }
    global.ClinicalActionParser=ClinicalActionParser;
})(typeof window!=="undefined"?window:globalThis);
