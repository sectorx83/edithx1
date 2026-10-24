// Shared Gemini client for Styx. Uses the user's own GEMINI_API_KEY against the
// Google Gemini API; falls back to the Lovable AI Gateway Gemini model until the
// key is saved. Server-only — never import from client code.

const GEMINI_MODEL = "gemini-2.5-flash";
const GATEWAY_MODEL = "google/gemini-3.1-flash-lite-preview";

export type GeminiContent = { role: "user" | "model"; parts: { text: string }[] };

async function callGeminiDirect(contents: GeminiContent[], systemPrompt: string, apiKey: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
    }),
  });
  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (res.status === 401 || res.status === 403) throw new Error("BAD_API_KEY");
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

async function callGeminiGateway(contents: GeminiContent[], systemPrompt: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Lovable-API-Key": key, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: GATEWAY_MODEL,
      stream: true,
      store: false,
      max_output_tokens: 1200,
      instructions: systemPrompt,
      input: contents.map((c) => ({ role: c.role === "model" ? "assistant" : "user", content: c.parts.map((p) => p.text).join("") })),
    }),
  });
  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (res.status === 402) throw new Error("CREDITS_DEPLETED");
  if (!res.ok || !res.body) throw new Error(`Gateway error ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.startsWith("data:")) continue;
      const d = l.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === "response.output_text.delta") out += ev.delta;
      } catch {}
    }
  }
  if (!out) throw new Error("Empty AI response");
  return out;
}

export async function callGemini(contents: GeminiContent[], systemPrompt: string): Promise<string> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (apiKey) return callGeminiDirect(contents, systemPrompt, apiKey);
  return callGeminiGateway(contents, systemPrompt);
}
