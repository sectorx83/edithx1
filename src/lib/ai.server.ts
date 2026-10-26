// Shared AI chat client for Styx. Priority: the user's Gemini key, then
// Gemini key, then the Lovable AI Gateway as a last resort. Server-only — never
// import from client code.

const GEMINI_MODEL = "gemini-3.8-flash";
const GATEWAY_MODEL = "google/gemini-3.1-flash-lite";

export type ChatMessage = { role: "user" | "assistant"; content: string };

async function callGeminiDirect(systemPrompt: string, messages: ChatMessage[], apiKey: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
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

async function callGateway(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
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
      input: messages,
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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("AI_TIMEOUT")), ms)),
  ]);
}

// Try each configured provider in order; fall through on any failure or timeout.
export async function callChat(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const attempts: (() => Promise<string>)[] = [];
  const openrouterKey = process.env["OPENROUTER_API_KEY"];
  if (openrouterKey) attempts.push(() => withTimeout(callOpenRouter(systemPrompt, messages, openrouterKey), 25000));
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (geminiKey) attempts.push(() => withTimeout(callGeminiDirect(systemPrompt, messages, geminiKey), 20000));
  attempts.push(() => withTimeout(callGateway(systemPrompt, messages), 25000));
  let lastErr: unknown;
  for (const a of attempts) {
    try {
      return await a();
    } catch (e) {
      lastErr = e;
      console.error("AI provider failed:", e instanceof Error ? e.message : e);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("AI unavailable");
}
