export type StyxSettings = {
  speak_replies: boolean;
  voice: string;
  tone: string;
  sensitive: string;
};

export const DEFAULT_SETTINGS: StyxSettings = {
  speak_replies: false,
  voice: "Charon",
  tone: "witty",
  sensitive: "balanced",
};

export const VOICES = [
  { id: "Charon", label: "Charon — deep, calm" },
  { id: "Kore", label: "Kore — firm, clear" },
  { id: "Puck", label: "Puck — upbeat" },
  { id: "Fenrir", label: "Fenrir — energetic" },
  { id: "Aoede", label: "Aoede — breezy" },
  { id: "Leda", label: "Leda — youthful" },
  { id: "Orus", label: "Orus — steady" },
  { id: "Zephyr", label: "Zephyr — bright" },
];

export const TONES: Record<string, { label: string; prompt: string }> = {
  witty: { label: "Witty", prompt: "Be witty and dry, with light humour, while staying helpful." },
  formal: { label: "Formal", prompt: "Be formal, polished and professional. No jokes." },
  friendly: { label: "Friendly", prompt: "Be warm, casual and encouraging, like a good friend." },
  concise: { label: "Concise", prompt: "Be extremely brief and to the point. Short sentences only." },
};

export const SENSITIVE: Record<string, { label: string; prompt: string }> = {
  cautious: {
    label: "Cautious",
    prompt: "On sensitive topics (health, mental health, legal, financial, self-harm, politics), be very careful: add clear disclaimers, avoid strong opinions, and recommend qualified professionals.",
  },
  balanced: {
    label: "Balanced",
    prompt: "On sensitive topics, give helpful factual information with a brief note to consult a professional when it truly matters.",
  },
  direct: {
    label: "Direct",
    prompt: "On sensitive topics, answer frankly and directly with minimal disclaimers, while still refusing anything genuinely harmful.",
  },
};

export function buildSystemPrompt(s: Partial<StyxSettings> | null) {
  const tone = TONES[s?.tone ?? ""] ?? TONES["witty"]!;
  const sens = SENSITIVE[s?.sensitive ?? ""] ?? SENSITIVE["balanced"]!;
  return `You are S.T.Y.X. (Styx), a loyal, ultra-competent AI assistant. ${tone.prompt} ${sens.prompt} Always be safe if someone may be in danger: share crisis resources.`;
}
