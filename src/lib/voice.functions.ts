import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VOICES = new Set(["Charon", "Kore", "Puck", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"]);

export const synthesizeSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { text: string; voice?: string }) => {
    const text = typeof data?.text === "string" ? data.text.trim().slice(0, 3500) : "";
    if (!text) throw new Error("Speech text is empty.");
    return { text, voice: typeof data.voice === "string" && VOICES.has(data.voice) ? data.voice : "Charon" };
  })
  .handler(async ({ data }) => {
    const supplied = [
      process.env["GEMINI_API_KEY_1"],
      process.env["GEMINI_API_KEY_2"],
      process.env["GEMINI_API_KEY_3"],
      process.env["GEMINI_API_KEY_4"],
      process.env["GEMINI_API_KEY"],
    ];
    const keys = [...new Set(supplied.filter((key): key is string => Boolean(key)))];
    if (!keys.length) throw new Error("Speech engine is not configured on the server.");
    let lastStatus = 0;
    for (const key of keys) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
          method: "POST",
          signal: controller.signal,
          headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Speak naturally as EDITH, a calm, precise, confident personal AI assistant. Use a clear, warm, low-mid register, measured pace, and natural conversational phrasing. Do not add words.\n\n" + data.text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: data.voice } },
              },
            },
          }),
        });
        if (response.status === 429 || response.status === 402) { lastStatus = response.status; continue; }
        if (response.status === 401 || response.status === 403) { lastStatus = response.status; continue; }
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.error("[EDITH TTS] Provider rejected request", { status: response.status, detail: detail.slice(0, 300) });
          throw new Error("Speech generation failed. Please try again.");
        }
        const result = await response.json() as {
          candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
        };
        const audio = result.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
        if (!audio?.data) throw new Error("Speech engine returned no audio.");
        return { audio: audio.data, mimeType: audio.mimeType ?? "audio/pcm", sampleRate: 24000 };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw new Error("Speech generation timed out. Try again.");
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
    if (lastStatus === 429 || lastStatus === 402) throw new Error("Gemini speech quota is currently unavailable.");
    throw new Error("Gemini rejected the configured speech credentials. Check the server API key.");
  });


export const transcribeSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { audio: string; mimeType?: string }) => {
    const audio = typeof data?.audio === "string" ? data.audio : "";
    if (!audio || audio.length > 12_000_000) throw new Error("Audio recording is empty or too large. Please record a shorter message.");
    return { audio, mimeType: data.mimeType === "audio/wav" ? "audio/wav" : "audio/wav" };
  })
  .handler(async ({ data }) => {
    const supplied = [
      process.env["GEMINI_API_KEY_1"],
      process.env["GEMINI_API_KEY_2"],
      process.env["GEMINI_API_KEY_3"],
      process.env["GEMINI_API_KEY_4"],
      process.env["GEMINI_API_KEY"],
    ];
    const keys = [...new Set(supplied.filter((key): key is string => Boolean(key)))];
    if (!keys.length) throw new Error("Speech recognition is not configured on the server.");
    let quota = false;
    for (const key of keys) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
          method: "POST",
          signal: controller.signal,
          headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: "Transcribe the spoken words in this audio verbatim. Return only the transcript, with no commentary. If no intelligible speech is present, return an empty string." },
                { inline_data: { mime_type: data.mimeType, data: data.audio } },
              ],
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 1200 },
          }),
        });
        if (response.status === 429 || response.status === 402) { quota = true; continue; }
        if (response.status === 401 || response.status === 403) continue;
        if (!response.ok) {
          console.error("[EDITH STT] Provider rejected audio", { status: response.status });
          throw new Error("Speech recognition failed. Please try again.");
        }
        const result = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] }[] }[] };
        const transcript = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
        return { text: transcript };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw new Error("Speech recognition timed out. Please try again.");
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error(quota ? "Speech recognition quota is currently unavailable." : "Gemini rejected the configured speech credentials.");
  });
