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
  return window.speechSynthesis?.getVoices().filter((voice) => voice.localService) ?? [];
}

export async function speakLocal(text: string, voiceId: string, signal: AbortSignal): Promise<void> {
  if (!window.speechSynthesis) throw new Error("Device speech playback is unavailable, sir.");
  const synth = window.speechSynthesis;
  signal.throwIfAborted();
  // Some devices populate their voices asynchronously.
  if (!localVoices().length) await new Promise<void>((resolve) => {
    const finish = () => { clearTimeout(timer); synth.removeEventListener("voiceschanged", finish); resolve(); };
    const timer = setTimeout(finish, 1500);
    synth.addEventListener("voiceschanged", finish);
  });
  signal.throwIfAborted();
  const voices = localVoices();
  const voice = voices.find((v) => v.voiceURI === voiceId) ?? voices.find((v) => v.lang.startsWith("en")) ?? voices[0];
  if (!voice) throw new Error("No offline voice is installed on this device, sir.");
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice; utterance.lang = voice.lang;
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); audioLevel.value = 0; audioLevel.source = "idle"; };
    const abort = () => { synth.cancel(); cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { synth.cancel(); cleanup(); reject(new Error("Device speech playback stalled, sir.")); }, Math.max(30000, text.length * 120));
    utterance.onstart = () => { audioLevel.source = "ai"; audioLevel.value = 0.2; };
    // Device synthesis doesn't expose PCM; boundaries reflect speech cadence, not loudness.
    utterance.onboundary = () => { audioLevel.value = 0.2 + Math.min(0.5, (utterance.text.length % 7) / 10); };
    utterance.onend = () => { cleanup(); resolve(); };
    utterance.onerror = () => { cleanup(); reject(new Error("Couldn't play the device voice, sir.")); };
    signal.addEventListener("abort", abort, { once: true });
    synth.speak(utterance);
  });
}