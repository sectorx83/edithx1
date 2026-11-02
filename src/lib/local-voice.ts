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


let kokoroWorker: Worker | undefined;
let kokoroSequence = 0;
const kokoroPending = new Map<number, { resolve: (audio: Float32Array) => void; reject: (error: Error) => void }>();

function getKokoroWorker(): Worker {
  if (kokoroWorker) return kokoroWorker;
  const worker = new Worker(new URL("./kokoro-voice.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<{ id: number; audio?: ArrayBuffer; sampleRate?: number; error?: string }>) => {
    const pending = kokoroPending.get(event.data.id);
    if (!pending) return;
    kokoroPending.delete(event.data.id);
    if (event.data.error || !event.data.audio) pending.reject(new Error(event.data.error || "Kokoro returned no audio."));
    else {
      const samples = new Float32Array(event.data.audio);
      // Attach metadata without changing the model's samples.
      Object.defineProperty(samples, "sampleRate", { value: event.data.sampleRate || 24000 });
      pending.resolve(samples);
    }
  };
  worker.onerror = () => {
    for (const pending of kokoroPending.values()) pending.reject(new Error("Kokoro voice worker failed to load."));
    kokoroPending.clear();
    worker.terminate();
    kokoroWorker = undefined;
  };
  kokoroWorker = worker;
  return worker;
}

/** Generate and play speech with the local Kokoro ONNX voice model. */
export async function speakKokoro(text: string, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const id = ++kokoroSequence;
  const worker = getKokoroWorker();
  const samples = await new Promise<Float32Array>((resolve, reject) => {
    const abort = () => {
      kokoroPending.delete(id);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    kokoroPending.set(id, {
      resolve: (audio) => { signal.removeEventListener("abort", abort); resolve(audio); },
      reject: (error) => { signal.removeEventListener("abort", abort); reject(error); },
    });
    worker.postMessage({ id, text: text.slice(0, 1800), voice: "am_michael" });
  });
  signal.throwIfAborted();
  const sampleRate = (samples as Float32Array & { sampleRate?: number }).sampleRate || 24000;
  const context = new AudioContext({ sampleRate });
  await context.resume();
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);
  const source = context.createBufferSource();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  source.buffer = buffer;
  source.connect(analyser);
  analyser.connect(context.destination);
  const levels = new Uint8Array(analyser.fftSize);
  let raf = 0;
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      cancelAnimationFrame(raf);
      signal.removeEventListener("abort", abort);
      audioLevel.value = 0;
      audioLevel.source = "idle";
      try { source.disconnect(); analyser.disconnect(); } catch {}
      void context.close();
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error); else resolve();
    };
    const abort = () => { try { source.stop(); } catch {} finish(new DOMException("Cancelled", "AbortError")); };
    const tick = () => {
      analyser.getByteTimeDomainData(levels);
      let sum = 0;
      for (const value of levels) { const sample = (value - 128) / 128; sum += sample * sample; }
      audioLevel.value = Math.min(1, Math.sqrt(sum / levels.length) * 5);
      audioLevel.source = "ai";
      raf = requestAnimationFrame(tick);
    };
    source.onended = () => finish();
    signal.addEventListener("abort", abort, { once: true });
    tick();
    source.start();
  });
}
