// Server-only Gemini client. Credentials never leave this module.

const GEMINI_MODEL = "gemini-3-flash-preview";

export type ChatMessage = { role: "user" | "assistant"; content: string };

async function callGeminiDirect(systemPrompt: string, messages: ChatMessage[], apiKey: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    signal,
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
    }),
  });
  if (res.status === 429 || res.status === 402) throw new Error("RATE_LIMITED");
  if (res.status === 401 || res.status === 403) throw new Error("BAD_API_KEY");
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

export async function callChat(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const supplied = [process.env["GEMINI_API_KEY_1"], process.env["GEMINI_API_KEY_2"], process.env["GEMINI_API_KEY_3"], process.env["GEMINI_API_KEY_4"]];
  const keys = [...new Set(supplied.filter((key): key is string => Boolean(key)))];
  if (!keys.length && process.env["GEMINI_API_KEY"]) keys.push(process.env["GEMINI_API_KEY"]);
  if (!keys.length) throw new Error("AI_UNAVAILABLE");
  for (const key of keys) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      return await callGeminiDirect(systemPrompt, messages, key, controller.signal);
    } catch (error) {
      // Quota, billing and credential failures can be resolved by another key.
      const reason = error instanceof Error ? error.message : "";
      if (reason !== "RATE_LIMITED" && reason !== "BAD_API_KEY") throw new Error("AI_UNAVAILABLE");
    } finally { clearTimeout(timer); }
  }
  throw new Error("AI_UNAVAILABLE");
}
