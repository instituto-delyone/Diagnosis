/* Diagnosis — Semantic Intent Remote Fallback
 * UMLS/terminology first, Gemini second.
 * Remote layers interpret language only; Diagnosis remains the authority
 * that validates and executes the resulting clinical action.
 */
"use strict";
(function(global){
    if(global.ClinicalIntentRemoteRouter)return;

    const DEFAULTS = {
        umlsProxy: "https://diagnosys-umls-proxy.delyone.workers.dev",
        geminiProxy: "https://diagnosis-gemini-proxy.delyone.workers.dev",
        timeoutMs: 12000,
        minimumConfidence: 0.70
    };

    const normalize = value => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s_:-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    class ClinicalIntentRemoteRouter {
        constructor(options = {}) {
            this.options = { ...DEFAULTS, ...options };
        }

        async fetchJSON(url, options = {}) {
            const controller = new AbortController();
            const timer = global.setTimeout(() => controller.abort(), this.options.timeoutMs);
            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                    headers: {
                        Accept: "application/json",
                        ...(options.headers || {})
                    }
                });
                const text = await response.text();
                let data = null;
                try { data = JSON.parse(text); } catch {}
                if (!response.ok) {
                    throw new Error("HTTP " + response.status);
                }
                return data;
            } catch (error) {
                if (error?.name === "AbortError") {
                    throw new Error("Tempo esgotado na consulta semântica remota.");
                }
                throw error;
            } finally {
                global.clearTimeout(timer);
            }
        }

        async queryUMLS(text) {
            const url = this.options.umlsProxy + "/?term=" + encodeURIComponent(text);
            const data = await this.fetchJSON(url, { method: "GET" });
            return data || {};
        }

        async queryGemini(text, context = {}) {
            const allowedActions = Array.isArray(context.allowedActions)
                ? context.allowedActions
                : [];

            const prompt = [
                "Mapeie a intenção clínica do jogador para UMA ação clínica canônica.",
                "Não invente diagnóstico, resultado de exame, estado do paciente ou conduta.",
                "Não execute a ação. Apenas identifique a intenção.",
                "Retorne JSON com: clinicalAction, confidence, target e rationale.",
                "Entrada do jogador: " + text
            ].join("\n");

            return this.fetchJSON(this.options.geminiProxy, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    context: "clinical_intent_mapping",
                    allowedActions
                })
            });
        }

        findDefinition(actionId, resolver) {
            if (!actionId || !resolver?.registry?.list) return null;
            const wanted = normalize(actionId);
            return resolver.registry.list().find(def => {
                const candidates = [
                    def?.id,
                    ...(Array.isArray(def?.aliases) ? def.aliases : [])
                ].filter(Boolean).map(normalize);
                return candidates.includes(wanted);
            }) || null;
        }

        normalizeRemoteAction(raw, source, resolver) {
            const actionId =
                raw?.clinicalAction ||
                raw?.clinical_action ||
                raw?.action?.id ||
                raw?.action ||
                null;

            const definition = this.findDefinition(actionId, resolver);
            if (!definition) return null;

            const confidence = Number(
                raw?.confidence ??
                raw?.score ??
                (source === "umls-proxy" ? 0.90 : 0.76)
            );

            if (!Number.isFinite(confidence) || confidence < this.options.minimumConfidence) {
                return null;
            }

            return {
                recognized: true,
                status: "resolved",
                intent: definition.id,
                action: {
                    id: definition.id,
                    domain: definition.domain,
                    operation: definition.operation,
                    targetType: definition.targetType || null,
                    target: raw?.target || null,
                    negated: Boolean(raw?.negated),
                    temporality: raw?.temporality || "present",
                    speechAct: raw?.speechAct || "request"
                },
                confidence: Math.min(0.99, confidence),
                evidence: {
                    remoteSource: source,
                    canonicalAction: definition.id,
                    rationale: raw?.rationale || null,
                    raw
                },
                source
            };
        }

        async resolve(text, context = {}) {
            let umlsError = null;

            try {
                const umls = await this.queryUMLS(text);
                const direct = this.normalizeRemoteAction(umls, "umls-proxy", context.resolver);
                if (direct) return direct;

                // Some UMLS proxies return a canonical phrase instead of the
                // registry id. Give the local resolver one chance to map it.
                const canonical = umls?.canonical_action;
                if (canonical && context.resolver?.resolve) {
                    const local = context.resolver.resolve(String(canonical));
                    if (local?.recognized) {
                        return {
                            ...local,
                            source: "umls-proxy",
                            evidence: {
                                ...(local.evidence || {}),
                                remoteSource: "umls-proxy",
                                umls
                            }
                        };
                    }
                }
            } catch (error) {
                umlsError = error?.message || String(error);
            }

            // Gemini é opt-in. O resolver remoto não deve disparar um modelo
            // generativo só porque a resolução local/UMLS não reconheceu a frase.
            if (context.useGemini !== true) {
                return {
                    recognized: false,
                    status: "unresolved",
                    source: "umls-only",
                    evidence: { umlsError }
                };
            }

            try {
                const gemini = await this.queryGemini(text, context);
                const payload = gemini?.result || gemini?.data || gemini || {};
                const resolved = this.normalizeRemoteAction(payload, "gemini-proxy", context.resolver);
                if (resolved) {
                    resolved.evidence = {
                        ...(resolved.evidence || {}),
                        umlsError
                    };
                    return resolved;
                }

                // If the proxy returned a canonical phrase, let the local
                // registry validate it rather than trusting arbitrary text.
                const canonical =
                    payload?.clinicalAction ||
                    payload?.clinical_action ||
                    payload?.canonical_action;

                if (canonical && context.resolver?.resolve) {
                    const local = context.resolver.resolve(String(canonical));
                    if (local?.recognized) {
                        return {
                            ...local,
                            source: "gemini-proxy",
                            evidence: {
                                ...(local.evidence || {}),
                                remoteSource: "gemini-proxy",
                                umlsError,
                                gemini: payload
                            }
                        };
                    }
                }
            } catch (error) {
                return {
                    recognized: false,
                    status: "remote_error",
                    confidence: 0,
                    source: "remote",
                    error: error?.message || String(error),
                    umlsError
                };
            }

            return {
                recognized: false,
                status: "unknown",
                confidence: 0,
                source: "remote",
                umlsError
            };
        }
    }

    global.ClinicalIntentRemoteRouter = ClinicalIntentRemoteRouter;
})(typeof window !== "undefined" ? window : globalThis);
