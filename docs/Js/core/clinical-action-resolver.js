/* Diagnosis — Phase 1 Clinical Action Resolver */
"use strict";
(function(global){
    const DEFAULTS={minimumConfidence:.58,ambiguityMargin:.08};
    const clone=v=>typeof structuredClone==="function"?structuredClone(v):JSON.parse(JSON.stringify(v));

    class ClinicalActionResolver{
        constructor(options={}){
            if(!global.ClinicalActionRegistry)throw new Error("ClinicalActionRegistry precisa ser carregado antes do Resolver.");
            if(!global.ClinicalActionParser)throw new Error("ClinicalActionParser precisa ser carregado antes do Resolver.");
            this.options={...DEFAULTS,...options};
            this.registry=options.registry instanceof global.ClinicalActionRegistry?options.registry:new global.ClinicalActionRegistry();
            this.parser=options.parser instanceof global.ClinicalActionParser?options.parser:new global.ClinicalActionParser(options.parserOptions);
        }
        normalize(v){return this.parser.normalize(v);}
        scoreAlias(text,alias,weight=1){
            const n=this.normalize(text),a=this.normalize(alias); if(!a)return 0;
            if(n===a)return 1*weight;
            const index=n.indexOf(a); if(index<0)return 0;
            const coverage=a.length/Math.max(a.length,n.length);
            const position=index===0?.08:0;
            const boundary=(n.startsWith(a+" ")||n.endsWith(" "+a))?.06:0;
            return Math.min(.99,(.56+coverage*.34+position+boundary)*weight);
        }
        scoreDefinition(clause,definition){
            const aliases=[definition.id,...(Array.isArray(definition.aliases)?definition.aliases:[])].filter(Boolean);
            const hits=aliases.map(alias=>({alias,score:this.scoreAlias(clause.normalized,alias)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
            if(!hits.length)return null;
            let score=hits[0].score;
            if(clause.speechAct==="request"&&definition.operation==="request")score+=.08;
            if(clause.speechAct==="declarative_action"&&["record","perform","activate"].includes(definition.operation))score+=.06;
            if(clause.speechAct==="hypothesis"&&definition.domain==="diagnosis")score+=.10;
            if(clause.question&&definition.operation==="query")score+=.08;
            const reassessmentVerb=clause.verbs.some(v=>["reavaliar","reavalie","rechecar"].includes(v));
            if(reassessmentVerb&&definition.id==="request_reassessment")score+=.20;
            if(reassessmentVerb&&definition.id!=="request_reassessment"&&definition.domain==="assessment")score-=.14;
            return {definition,score:Math.min(.99,score),matchedAlias:hits[0].alias};
        }
        scoreTargets(text,definition){
            const raw=this.registry.findTargetCandidates(text,definition.id),best=new Map();
            for(const c of raw){
                const key=c.actionId+"::"+c.targetId;
                const item={...c,score:Math.min(.99,.62+Math.min(.28,c.lexicalScore/120))};
                if(!best.has(key)||item.score>best.get(key).score)best.set(key,item);
            }
            return [...best.values()].sort((a,b)=>b.score-a.score);
        }
        chooseTarget(candidates){
            if(!candidates.length)return null;
            const sorted=[...candidates].sort((a,b)=>b.score-a.score),best=sorted[0],second=sorted[1];
            if(second&&Math.abs(best.score-second.score)<this.options.ambiguityMargin)
                return {status:"ambiguous",target:null,candidates:sorted.slice(0,4)};
            return {status:"resolved",target:{id:best.targetId,canonical:best.target?.canonical||best.targetId,matchedAlias:best.matchedAlias},candidates:sorted.slice(0,4)};
        }
        scoreCandidate(clause){
            const candidates=[];
            for(const definition of this.registry.list()){
                const scored=this.scoreDefinition(clause,definition);
                const targets=this.scoreTargets(clause.normalized,definition);
                const targetResult=this.chooseTarget(targets);
                let score=scored?.score||0,matchedAlias=scored?.matchedAlias||null;

                if(!scored&&targetResult?.target){
                    const requestLike=["request","declarative_action"].includes(clause.speechAct)||clause.negation.negated||clause.temporality==="past";
                    const actionVerb=clause.verbs.some(v=>[
                        "solicitar","solicito","solicitei","solicitou","peco","quero","pedi","fazer","faca","realizar",
                        "colher","perguntar","pergunte","avaliar","avalie","examinar","examino","examine","checar","cheque",
                        "verificar","verifique","aferir","afira","medir","meca","reavaliar","reavalie"
                    ].includes(v));
                    const compatible=["request","perform","activate","record"].includes(definition.operation);
                    if(requestLike&&actionVerb&&compatible){
                        score=.80;
                        matchedAlias=targetResult.target.canonical||targetResult.candidates?.[0]?.matchedAlias||null;
                    }
                }
                if(!score)continue;
                if(definition.targetType&&targetResult?.target)score=Math.min(.99,score+.10);
                if(clause.negation.negated)score=Math.max(0,score-.02);
                candidates.push({definition,score,matchedAlias,targetResult,targetCandidates:targets});
            }
            return candidates.sort((a,b)=>b.score-a.score);
        }
        evidence(clause,winner,candidates){
            return {
                matchedAlias:winner?.matchedAlias||null,
                verbs:clone(clause.verbs),
                speechAct:clause.speechAct,
                question:clause.question,
                negation:clone(clause.negation),
                temporality:clause.temporality,
                targetCandidates:(winner?.targetCandidates||[]).slice(0,4).map(x=>({
                    actionId:x.actionId,targetId:x.targetId,matchedAlias:x.matchedAlias,score:x.score
                })),
                competingActions:candidates.slice(1,4).map(x=>({
                    id:x.definition.id,score:x.score,matchedAlias:x.matchedAlias
                }))
            };
        }
        resolveClause(clause){
            if(!clause.normalized)return {recognized:false,status:"unknown",intent:null,action:null,confidence:0,evidence:{},clause};
            const candidates=this.scoreCandidate(clause);
            if(!candidates.length)return {
                recognized:false,status:"unknown",intent:null,action:null,confidence:0,
                evidence:{verbs:clause.verbs,speechAct:clause.speechAct,question:clause.question,negation:clause.negation,temporality:clause.temporality},
                clause
            };
            const winner=candidates[0],second=candidates[1];
            if(winner.score<this.options.minimumConfidence)return {
                recognized:false,status:"unknown",intent:null,action:null,confidence:Number(winner.score.toFixed(3)),
                evidence:this.evidence(clause,winner,candidates),clause
            };
            if(second&&Math.abs(winner.score-second.score)<this.options.ambiguityMargin&&winner.definition.id!==second.definition.id)return {
                recognized:false,status:"ambiguous",intent:null,action:null,confidence:Number(winner.score.toFixed(3)),
                candidates:candidates.slice(0,4).map(x=>({id:x.definition.id,domain:x.definition.domain,operation:x.definition.operation,score:Number(x.score.toFixed(3)),matchedAlias:x.matchedAlias})),
                evidence:this.evidence(clause,winner,candidates),clause
            };
            if(winner.targetResult?.status==="ambiguous")return {
                recognized:false,status:"ambiguous",intent:null,action:null,confidence:Number(winner.score.toFixed(3)),
                candidates:winner.targetResult.candidates.slice(0,4).map(x=>({actionId:x.actionId,targetId:x.targetId,matchedAlias:x.matchedAlias,score:Number(x.score.toFixed(3))})),
                evidence:this.evidence(clause,winner,candidates),clause
            };
            const action={
                id:winner.definition.id,domain:winner.definition.domain,operation:winner.definition.operation,
                targetType:winner.definition.targetType||null,target:winner.targetResult?.target||null,
                negated:Boolean(clause.negation.negated),temporality:clause.temporality,speechAct:clause.speechAct
            };
            return {recognized:true,status:"resolved",intent:winner.definition.id,action,confidence:Number(winner.score.toFixed(3)),evidence:this.evidence(clause,winner,candidates),clause};
        }
        resolve(text,options={}){
            const parsed=this.parser.parse(text);
            if(parsed.empty)return {recognized:false,status:"unknown",intent:null,action:null,actions:[],clauses:[],confidence:0,evidence:{},originalText:parsed.original,normalizedText:parsed.normalized};
            const clauses=parsed.clauses.map(c=>this.resolveClause(c));
            const recognized=clauses.filter(x=>x.recognized),ambiguous=clauses.filter(x=>x.status==="ambiguous");
            let status="unknown";
            if(recognized.length===parsed.clauseCount)status="resolved";
            else if(recognized.length||ambiguous.length)status="partial";
            if(ambiguous.length&&!recognized.length)status="ambiguous";
            const confidence=recognized.length
                ?Number((recognized.reduce((s,x)=>s+x.confidence,0)/recognized.length).toFixed(3))
                :ambiguous.length?Number(Math.max(...ambiguous.map(x=>x.confidence||0)).toFixed(3)):0;
            const primary=recognized[0]||ambiguous[0]||clauses[0];
            const result={
                recognized:recognized.length>0,status,
                intent:recognized.length===1?recognized[0].intent:null,
                action:recognized.length===1?recognized[0].action:null,
                actions:recognized.map(x=>x.action),clauses,confidence,
                evidence:primary?.evidence||{},originalText:parsed.original,normalizedText:parsed.normalized
            };
            if(ambiguous.length)result.ambiguities=ambiguous.map(x=>({clause:x.clause.original,candidates:x.candidates||[],evidence:x.evidence||{}}));
            if(options.includeParserOutput!==false)result.parser=parsed;
            return result;
        }
    }
    global.ClinicalActionResolver=ClinicalActionResolver;
})(typeof window!=="undefined"?window:globalThis);
