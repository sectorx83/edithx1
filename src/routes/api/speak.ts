import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { VOICES } from "@/lib/styx-settings";

export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace("Bearer ", "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u } = await sb.auth.getUser(token);
        if (!u.user) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json().catch(() => null)) as { text?: string; voice?: string } | null;
        const text = String(body?.text ?? "").slice(0, 3000);
        if (!text) return new Response("No text", { status: 400 });
        const voice = VOICES.some((v) => v.id === body?.voice) ? body!.voice! : "Charon";

        const key = process.env["GEMINI_API_KEY"];
        if (!key) return new Response("Voice not configured", { status: 500 });
        const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
          method: "POST",
          headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
          }),
          signal: request.signal,
        });
        if (!res.ok) return new Response(await res.text(), { status: res.status });
        const j = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
        const audio = j.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data)?.inlineData?.data;
        if (!audio) return new Response("No audio", { status: 502 });
        const sse = `data: ${JSON.stringify({ type: "speech.audio.delta", audio })}\n\ndata: ${JSON.stringify({ type: "speech.audio.done" })}\n\n`;
        return new Response(sse, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
      },
    },
  },
});
