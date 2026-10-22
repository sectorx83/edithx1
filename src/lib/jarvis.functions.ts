import { createServerFn } from "@tanstack/react-start";

type Msg = { role: "user" | "assistant"; content: string };

export const askJarvis = createServerFn({ method: "POST" })
  .inputValidator((d: { messages: Msg[] }) => {
    if (!Array.isArray(d?.messages)) throw new Error("Invalid input");
    return { messages: d.messages.slice(-20).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 4000) })) as Msg[] };
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are J.A.R.V.I.S., Tony Stark's witty, loyal, ultra-competent AI assistant. Address the user as 'sir' occasionally. Be concise, crisp, and helpful." },
          ...data.messages,
        ],
      }),
    });
    if (res.status === 429) return { reply: "Systems are throttled, sir. Please try again in a moment." };
    if (res.status === 402) return { reply: "AI credits are depleted, sir. Please top up to continue." };
    if (!res.ok) return { reply: "I'm experiencing a malfunction, sir. Please try again." };
    const json = await res.json();
    return { reply: (json.choices?.[0]?.message?.content as string) ?? "..." };
  });
