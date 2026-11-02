import { audioLevel } from "@/lib/audio-level";

let worker: Worker | undefined;
let sequence = 0;
let pending: { id: number; resolve: (result: { text: string; error: string }) => void } | undefined;

export function cancelLocalTranscription() {
  worker?.terminate();
  worker = undefined;
  pending?.resolve({ text: "", error: "" });
  pending = undefined;
}

export async function transcribeLocal(file: File): Promise<{ text: string; error: string }> {
  if (pending) throw new Error("Speech recognition is already running.");
  const view = new DataView(await file.arrayBuffer());
  const sampleRate = view.getUint32(24, true);
  const count = (view.byteLength - 44) / 2;
  const audio = new Float32Array(Math.floor(count * 16000 / sampleRate));
  for (let i = 0; i < audio.length; i++) {
    const position = i * sampleRate / 16000;
    const left = Math.floor(position), right = Math.min(count - 1, left + 1);
    const fraction = position - left;
    audio[i] = (view.getInt16(44 + left * 2, true) * (1 - fraction) + view.getInt16(44 + right * 2, true) * fraction) / 32768;
  }
  worker ??= new Worker(new URL("./local-voice.worker.ts", import.meta.url), { type: "module" });
  const activeWorker = worker;
  const id = ++sequence;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cancelLocalTranscription();
      resolve({ text: "", error: "Device speech recognition took too long, sir. Please try again." });
    }, 180000);
    pending = { id, resolve: (result) => { clearTimeout(timer); resolve(result); } };
    activeWorker.onmessage = (event: MessageEvent<{ id: number; text?: string; error?: string }>) => {
      if (pending?.id !== event.data.id) return;
      pending.resolve({ text: event.data.text ?? "", error: event.data.error ?? "" });
      pending = undefined;
    };
    activeWorker.onerror = () => {
      pending?.resolve({ text: "", error: "Device speech recognition is unavailable, sir. Please use text." });
      pending = undefined;
      activeWorker.terminate(); worker = undefined;
    };
    activeWorker.postMessage({ id, audio }, [audio.buffer]);
  });
}

export function localVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis?.getVoices() ?? [];
}

export async function speakLocal(text: string, voiceId: string, signal: AbortSignal): Promise<void> {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    throw new Error("Speech playback is not supported by this browser. Open EDITH in Chrome.");
  }
  const synth = window.speechSynthesis;
  signal.throwIfAborted();
  synth.cancel();

  // Android/Chrome may load installed voices after the page. Wait briefly, but
  // never make speech depend on an offline voice being installed.
  let voices = synth.getVoices();
  if (!voices.length) {
    await new Promise<void>((resolve) => {
      const finish = () => { clearTimeout(timer); synth.removeEventListener("voiceschanged", finish); resolve(); };
      const timer = window.setTimeout(finish, 900);
      synth.addEventListener("voiceschanged", finish, { once: true });
    });
    voices = synth.getVoices();
  }
  signal.throwIfAborted();
  const voice = voices.find((v) => v.voiceURI === voiceId)
    ?? voices.find((v) => /^en(-|_)/i.test(v.lang))
    ?? voices[0];

  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
  else utterance.lang = "en-US";
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      audioLevel.value = 0;
      audioLevel.source = "idle";
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error); else resolve();
    };
    const abort = () => { synth.cancel(); finish(new DOMException("Cancelled", "AbortError")); };
    const timer = window.setTimeout(() => {
      synth.cancel();
      finish(new Error("Speech playback timed out. Tap the voice core and try again."));
    }, Math.max(30000, text.length * 180));
    utterance.onstart = () => { audioLevel.source = "ai"; audioLevel.value = .34; };
    utterance.onboundary = () => { audioLevel.value = .42 + Math.min(.38, (utterance.text.length % 7) / 16); };
    utterance.onend = () => finish();
    utterance.onerror = (event) => finish(new Error(event.error === "not-allowed"
      ? "Tap the voice core once to allow audio playback."
      : "The device could not play its speech voice."));
    signal.addEventListener("abort", abort, { once: true });
    synth.speak(utterance);
    // Chrome on Android can pause a long utterance in the background.
    window.setTimeout(() => { if (!settled && synth.paused) synth.resume(); }, 250);
  });
}
