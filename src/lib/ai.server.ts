// Shared AI chat client for Styx. Uses only the user's own Gemini key.
// No gateway fallback. Server-only — never import from client code.

const GEMINI_MODEL = "gemini-3-flash-preview";

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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("AI_TIMEOUT")), ms)),
  ]);
}

// Single provider: the user's Gemini key. Failures surface as-is — no fallback.
export async function callChat(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (!geminiKey) throw new Error("AI is not configured");
  return withTimeout(callGeminiDirect(systemPrompt, messages, geminiKey), 20000);
}
