"use strict";

(function (global) {
    class ClinicalKnowledgeResolver {
        constructor(options = {}) {
            this.basePath = options.basePath || "knowledge_base/interaction";
            this.sources = [];
            this.entries = [];
            this.index = new Map();
            this.semanticSources = [];
            this.semanticConcepts = [];
            this.semanticIntents = [];
            this.loaded = false;
        }

        normalize(value) {
            return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9+.-]+/g, " ").replace(/\s+/g, " ").trim();
        }

        tokenize(value) { return this.normalize(value).split(" ").filter(token => token.length >= 3); }

        addToIndex(term, entry) {
            const normalized = this.normalize(term);
            if (!normalized) return;
            if (!this.index.has(normalized)) this.index.set(normalized, new Set());
            this.index.get(normalized).add(entry.id);
        }

        indexEntry(entry) {
            const fields = [entry.id, entry.title, entry.name, entry.topic, entry.section, entry.chapter, ...(Array.isArray(entry.aliases) ? entry.aliases : []), ...(Array.isArray(entry.terms) ? entry.terms : [])];
            fields.filter(Boolean).forEach(value => this.addToIndex(value, entry));
            fields.filter(Boolean).forEach(value => this.tokenize(value).forEach(token => this.addToIndex(token, entry)));
        }

        flattenCorpus(corpus, sourcePath) {
            const output = [];
            const visit = (value, context = {}) => {
                if (Array.isArray(value)) return value.forEach(item => visit(item, context));
                if (!value || typeof value !== "object") return;
                const text = value.source_text || value.text || value.content || value.body;
                const hasClinicalIdentity = value.id || value.title || value.name || value.topic || value.section;
                if (text && hasClinicalIdentity) output.push({...value, id:String(value.id || `${sourcePath}:${output.length}`), source:sourcePath, chapter:value.chapter || context.chapter || null});
                const nextContext = {chapter:value.chapter || context.chapter || null};
                Object.entries(value).forEach(([key, child]) => { if (!["source_text","text","content","body"].includes(key)) visit(child, nextContext); });
            };
            visit(corpus);
            return output;
        }

        async loadSource(path) {
            const response = await fetch(path, {cache:"no-store"});
            if (!response.ok) throw new Error(`Falha ao carregar corpus clínico: HTTP ${response.status}`);
            const corpus = await response.json();
            const entries = this.flattenCorpus(corpus, path);
            this.sources.push({path, corpus, entries});
            entries.forEach(entry => { this.entries.push(entry); this.indexEntry(entry); });
            return entries.length;
        }

        async loadSemanticSource(path) {
            const response = await fetch(path, {cache:"no-store"});
            if (!response.ok) throw new Error(`Falha ao carregar CSI: HTTP ${response.status}`);
            const source = await response.json();
            this.semanticSources.push({path, source});
            (source.concepts || []).forEach(concept => this.semanticConcepts.push({...concept, source:path}));
            (source.intents || []).forEach(intent => this.semanticIntents.push({...intent, source:path}));
            const lexicon = source.current_repository_lexicon || {};
            (lexicon.semiology || []).forEach(item => this.semanticConcepts.push({id:item.anchor, canonical:item.canonical, aliases:Object.values(item.variants || {}).flat(), source:path}));
        }

        async loadSemanticLayer() {
            const paths = [
                "AI/CSI_SEMANTIC_LAYER.json",
                "AI/csi_extended_dispneia_cm12.json",
                "AI/csi_extended_has_dislipidemia_cm3.json",
                "AI/diagnosis_csi_glicemia_consciencia_v1.json",
                "AI/diagnosis_csi_pulso_circulacao_v1.json"
            ];
            for (const path of paths) {
                try { await this.loadSemanticSource(path); }
                catch (error) { console.warn("CSI opcional não carregado:", path, error.message); }
            }
        }

        async load(paths = []) {
            const sourcePaths = paths.length ? paths : [`${this.basePath}/cardiologia/cardiologia_tratado_interaction_v1.json`];
            for (const path of sourcePaths) await this.loadSource(path);
            await this.loadSemanticLayer();
            this.loaded = true;
            return this.summary();
        }

        scoreEntry(entry, query) {
            const normalizedQuery = this.normalize(query);
            const queryTokens = this.tokenize(query);
            const haystack = this.normalize([entry.id, entry.title, entry.name, entry.topic, entry.section, entry.chapter, ...(Array.isArray(entry.aliases) ? entry.aliases : []), ...(Array.isArray(entry.terms) ? entry.terms : [])].filter(Boolean).join(" "));
            let score = haystack.includes(normalizedQuery) ? 10 : 0;
            queryTokens.forEach(token => { if (haystack.includes(token)) score += 2; });
            return score;
        }

        resolve(query, options = {}) {
            const limit = Number(options.limit || 5);
            const normalizedQuery = this.normalize(query);
            if (!normalizedQuery) return [];
            const candidateIds = new Set();
            this.index.forEach((ids, term) => { if (term.includes(normalizedQuery) || normalizedQuery.includes(term)) ids.forEach(id => candidateIds.add(id)); });
            return this.entries.filter(entry => candidateIds.has(entry.id)).map(entry => ({entry, score:this.scoreEntry(entry, query)})).filter(item => item.score > 0).sort((a,b) => b.score-a.score).slice(0,limit).map(item => ({...item.entry, relevance:item.score}));
        }

        search(query, options = {}) { return this.resolve(query, options); }
        findById(id) { const normalizedId=this.normalize(id); return this.entries.find(entry => this.normalize(entry.id)===normalizedId) || null; }
        getText(entry) { return entry ? (entry.source_text || entry.text || entry.content || entry.body || null) : null; }

        resolveSemantic(text) {
            const normalized = this.normalize(text);
            if (!normalized) return null;
            const candidates = [];
            for (const intent of this.semanticIntents) {
                for (const alias of intent.aliases || []) {
                    const a=this.normalize(alias);
                    if (a && (normalized===a || normalized.includes(a))) candidates.push({kind:"intent",id:intent.id,action:intent.action || (intent.actions || [])[0] || null,score:a.length+20,source:intent.source});
                }
                for (const example of intent.examples || []) {
                    const e=this.normalize(example);
                    if (e && (normalized===e || normalized.includes(e) || e.includes(normalized))) candidates.push({kind:"intent",id:intent.id,action:intent.action || (intent.actions || [])[0] || null,score:e.length+100,source:intent.source});
                }
            }
            for (const concept of this.semanticConcepts) {
                for (const alias of concept.aliases || []) {
                    const a=this.normalize(alias);
                    if (a && (a.length<=3 ? new RegExp(`(^|\\s)${a.replace(/[+]/g,"\\+")}(?=\\s|$)`).test(normalized) : normalized.includes(a))) candidates.push({kind:"concept",id:concept.id,canonical:concept.canonical || concept.id,matchedAlias:alias,score:a.length,source:concept.source});
                }
            }
            candidates.sort((a,b)=>b.score-a.score);
            if (!candidates.length) return null;
            const intent=candidates.find(item=>item.kind==="intent");
            const concept=candidates.find(item=>item.kind==="concept");
            return {intent:intent?.id || null,action:intent?.action || null,concept:concept?.id || null,canonical:concept?.canonical || null,matchedAlias:concept?.matchedAlias || null,source:intent?.source || concept?.source || null,confidence:intent ? 0.92 : 0.75};
        }

        summary() { return {loaded:this.loaded,sources:this.sources.length,entries:this.entries.length,index_terms:this.index.size,semantic_sources:this.semanticSources.length,semantic_concepts:this.semanticConcepts.length,semantic_intents:this.semanticIntents.length}; }
    }

    global.ClinicalKnowledgeResolver = ClinicalKnowledgeResolver;

    if (global.ClinicalInterlocutor?.prototype && !global.ClinicalInterlocutor.prototype.__csiSemanticPatched) {
        const originalInterpret = global.ClinicalInterlocutor.prototype.interpret;
        global.ClinicalInterlocutor.prototype.interpret = function(text) {
            const semantic=this.clinicalKnowledgeResolver?.resolveSemantic?.(text);
            if (semantic?.intent === "treatment_proposal" || semantic?.action === "record_treatment") {
                const sourceText=String(text || "").trim();
                const previous=this.history?.[this.history.length-1];
                const continuation=previous?.intent === "treatment";
                const concept=semantic.concept || sourceText;
                const result={recognized:true,intent:"treatment",target:concept,message:continuation ? `Entendi. Você está especificando ${concept} como parte da conduta anterior. Registrei essa informação. Qual é o próximo passo?` : `Entendi a proposta terapêutica${concept ? ` (${concept})` : ""}. Registrei a conduta no caso. Qual é o próximo passo?`,data:{action:"record_treatment",concept,sourceText,semanticSource:"CSI",matchedAlias:semantic.matchedAlias || null,confidence:semantic.confidence}};
                this.history.push({input:sourceText,intent:result.intent,target:result.target,timestamp:Date.now()});
                return result;
            }
            return originalInterpret.call(this,text);
        };
        global.ClinicalInterlocutor.prototype.__csiSemanticPatched=true;
    }
})(typeof window !== "undefined" ? window : globalThis);
