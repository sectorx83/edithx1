import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: FormData) => {
    if (!(d instanceof FormData)) throw new Error("Invalid input");
    const file = d.get("file");
    if (!(file instanceof File) || !file.size || file.size > 20_000_000) throw new Error("Invalid audio");
    return d;
  })
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");
    const file = data.get("file") as File;
    const form = new FormData();
    form.append("model", "openai/gpt-transcribe");
    form.append("file", file, "recording.wav");
    form.append("response_format", "json");
    form.append("stream", "true");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (res.status === 429) return { text: "", error: "Too many requests, please wait a moment." };
    if (res.status === 402) return { text: "", error: "AI credits are depleted." };
    if (!res.ok || !res.body) return { text: "", error: "Couldn't understand the audio. Please try again." };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", out = "", final = "";
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
          if (ev.type === "transcript.text.delta") out += ev.delta ?? "";
          if (ev.type === "transcript.text.done") final = ev.text ?? "";
        } catch {}
      }
    }
    return { text: (final || out).trim(), error: "" };
  });
