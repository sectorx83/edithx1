// Server-only Groq client. Credentials never leave this module.

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const REQUEST_TIMEOUT_MS = 20_000;

export type ChatMessage = { role: "user" | "assistant"; content: string };

type GroqResponse = {
  choices?: {
    message?: {
      content?: string | { type?: string; text?: string }[] | null;
    };
  }[];
};

function getApiKeys(): string[] {
  const configured = [
    process.env["GROQ_API_KEY_1"],
    process.env["GROQ_API_KEY_2"],
    process.env["GROQ_API_KEY_3"],
    process.env["GROQ_API_KEY_4"],
    process.env["GROQ_API_KEY"],
  ];
  return [...new Set(configured.map((key) => key?.trim()).filter((key): key is string => Boolean(key)))];
}

function readResponseText(data: GroqResponse): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("")
      .trim();
  }
  return "";
}

async function callGroqDirect(
  systemPrompt: string,
  messages: ChatMessage[],
  apiKey: string,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env["GROQ_MODEL"]?.trim() || DEFAULT_GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(({ role, content }) => ({ role, content })),
      ],
      temperature: 0.7,
      max_completion_tokens: 1200,
    }),
  });

  if (response.status === 429 || response.status === 402) throw new Error("RATE_LIMITED");
  if (response.status === 401 || response.status === 403) throw new Error("BAD_API_KEY");
  if (!response.ok) throw new Error("PROVIDER_ERROR");

  const data = (await response.json()) as GroqResponse;
  const reply = readResponseText(data);
  if (!reply) throw new Error("EMPTY_RESPONSE");
  return reply;
}

export async function callChat(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const keys = getApiKeys();
  if (!keys.length) throw new Error("AI_NOT_CONFIGURED");

  let sawQuota = false;
  let sawBadKey = false;

  for (const key of keys) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await callGroqDirect(systemPrompt, messages, key, controller.signal);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      if (reason === "RATE_LIMITED") {
        sawQuota = true;
        continue;
      }
      if (reason === "BAD_API_KEY") {
        sawBadKey = true;
        continue;
      }

      const timedOut = error instanceof Error && error.name === "AbortError";
      const category = timedOut ? "timeout" : "network_or_provider_error";
      console.error("[EDITH AI] Groq request failed", { category });
      throw new Error(timedOut ? "AI_TIMEOUT" : "AI_PROVIDER_ERROR");
    } finally {
      clearTimeout(timer);
    }
  }

  if (sawQuota) throw new Error("AI_RATE_LIMITED");
  if (sawBadKey) throw new Error("AI_BAD_API_KEY");
  throw new Error("AI_PROVIDER_ERROR");
}
