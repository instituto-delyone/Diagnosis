/**
 * Diagnosys Gemini Worker — canonical Cloudflare Worker adapter
 * Version 1.2.0
 *
 * Secrets:
 *   GEMINI_API_KEY  (secret)
 *
 * Variables:
 *   GEMINI_MODEL    (optional; default: gemini-3.6-flash)
 */
const DEFAULT_MODEL = "gemini-3.6-flash";
const ALLOWED_ORIGINS = ["*"];

const RESPONSE_SHAPE = {
  type: "object",
  properties: {
    concept: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          content: { type: "string" },
          sources: { type: "array", items: { type: "string" } }
        },
        required: ["topic", "content"]
      }
    }
  },
  required: ["concept", "sections"]
};

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  const allowOrigin = ALLOWED_ORIGINS.includes("*") ? "*" : origin;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept",
    "Access-Control-Max-Age": "86400"
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request)
    }
  });
}

function cleanJsonText(value) {
  let text = String(value || "").trim();
  if (text.startsWith("```")) {
    text = text.replace(/^\`\`\`(?:json)?\s*/i, "");
    text = text.replace(/\s*\`\`\`$/i, "");
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) text = text.slice(first, last + 1);
  return text;
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map(part => part?.text || "").join("").trim();
}

function buildPrompt(input) {
  const concept = String(input.disease || input.concept || "").trim();
  const topics = Array.isArray(input.topics) && input.topics.length
    ? input.topics
    : ["fisiopatologia", "epidemiologia", "clinica", "exame_fisico", "diagnostico", "tratamento", "complicacoes", "evolucao"];

  return [
    "Você é uma camada de síntese científica do Diagnosys.",
    "Não construa nem altere a verdade interna de um caso clínico.",
    "Responda SOMENTE com JSON válido, sem markdown e sem texto antes/depois.",
    "O JSON deve ter exatamente esta forma lógica:",
    JSON.stringify({ concept, sections: [{ topic: "string", content: "string", sources: ["string"] }] }),
    "Conceito clínico: " + concept,
    "Tópicos solicitados: " + topics.join(", "),
    "Fontes prioritárias solicitadas: Manual MSD Profissional e Ministério da Saúde/PCDT.",
    "Se uma fonte não estiver disponível, não invente citação. Indique a limitação no conteúdo.",
    "Não dê diagnóstico para um paciente específico; sintetize conhecimento clínico geral.",
    "Mantenha cada seção objetiva e clinicamente útil."
  ].join("\n");
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        ok: true,
        service: "Diagnosys Gemini Research Worker",
        version: "1.2.0",
        model_default: env.GEMINI_MODEL || DEFAULT_MODEL,
        routes: ["/", "/api/gemini/research"]
      }, 200, request);
    }

    if (request.method !== "POST" || url.pathname !== "/api/gemini/research") {
      return json({
        ok: false,
        error: "Not found",
        routes: ["/", "/api/gemini/research"]
      }, 404, request);
    }

    if (!env.GEMINI_API_KEY) {
      return json({ ok: false, error: "GEMINI_API_KEY is not configured" }, 500, request);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON body" }, 400, request);
    }

    const disease = String(input?.disease || input?.concept || "").trim();
    if (!disease) {
      return json({ ok: false, error: "Disease or concept is required" }, 400, request);
    }

    const model = String(env.GEMINI_MODEL || DEFAULT_MODEL).trim();
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) +
      ":generateContent?key=" +
      encodeURIComponent(env.GEMINI_API_KEY);

    const body = {
      contents: [{
        role: "user",
        parts: [{ text: buildPrompt(input) }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SHAPE
      }
    };

    let upstream;
    let upstreamText;

    try {
      upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      upstreamText = await upstream.text();
    } catch (error) {
      return json({
        ok: false,
        error: "Gemini upstream connection failed",
        details: error?.message || String(error)
      }, 502, request);
    }

    if (!upstream.ok) {
      let details = upstreamText;
      try {
        const parsed = JSON.parse(upstreamText);
        details = parsed?.error?.message || parsed?.error || parsed;
      } catch {}
      return json({
        ok: false,
        error: "Gemini upstream error",
        status: upstream.status,
        details
      }, 502, request);
    }

    let upstreamData;
    try {
      upstreamData = JSON.parse(upstreamText);
    } catch {
      return json({
        ok: false,
        error: "Gemini returned non-JSON HTTP payload"
      }, 502, request);
    }

    const generatedText = extractText(upstreamData);
    if (!generatedText) {
      return json({
        ok: false,
        error: "Gemini returned no generated text",
        details: upstreamData?.promptFeedback || upstreamData?.candidates || null
      }, 502, request);
    }

    let result;
    try {
      result = JSON.parse(cleanJsonText(generatedText));
    } catch (error) {
      return json({
        ok: false,
        error: "Gemini generated text was not valid JSON",
        details: String(error?.message || error),
        raw_preview: generatedText.slice(0, 600)
      }, 502, request);
    }

    if (!result || typeof result !== "object" || !Array.isArray(result.sections)) {
      return json({
        ok: false,
        error: "Gemini JSON did not match the research contract"
      }, 502, request);
    }

    return json({
      ok: true,
      model,
      source: "gemini",
      result: {
        concept: result.concept || disease,
        sections: result.sections
      }
    }, 200, request);
  }
};
