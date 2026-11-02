import { createParser } from "eventsource-parser";
import { audioLevel, readLevel } from "@/lib/audio-level";

export function decodePCM(pending: Uint8Array, incoming: Uint8Array) {
  const bytes = new Uint8Array(pending.length + incoming.length);
  bytes.set(pending);
  bytes.set(incoming, pending.length);
  const usable = bytes.length - (bytes.length % 2);
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(usable / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, pending: bytes.slice(usable) };
}

let shared: AudioContext | null = null;
/** Call from a tap/click so mobile browsers allow later playback. */
export function unlockAudio(): AudioContext {
  if (!shared || shared.state === "closed") shared = new AudioContext({ sampleRate: 24000 });
  void shared.resume().catch(() => {});
  const b = shared.createBuffer(1, 1, 24000); const s = shared.createBufferSource(); s.buffer = b; s.connect(shared.destination); s.start();
  return shared;
}

export async function streamSpeech(endpoint: string, body: Record<string, unknown>, headers: Record<string, string>, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  if (!shared || shared.state === "closed") shared = new AudioContext({ sampleRate: 24000 });
  const context = shared;
  const sources = new Set<AudioBufferSourceNode>();
  let playhead = 0;
  let pending = new Uint8Array(0);
  let completed = false;
  let samplesPlayed = 0;
  const controller = new AbortController();
  const abort = () => {
    controller.abort(signal?.reason);
    for (const source of sources) source.stop();
  };
  signal?.addEventListener("abort", abort, { once: true });
  let playback: Promise<void> = Promise.resolve();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.connect(context.destination);
  const lvlBuf = new Uint8Array(analyser.fftSize);
  let raf = 0;
  const tick = () => { audioLevel.value = readLevel(analyser, lvlBuf); audioLevel.source = "ai"; raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  try {
    if (context.state !== "running") await Promise.race([context.resume(), new Promise((r) => setTimeout(r, 1500))]);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`TTS failed: ${response.status} ${await response.text()}`);
    const parser = createParser({
      onEvent(event) {
        const payload = JSON.parse(event.data) as { type: string; audio?: string; error?: unknown };
        if (payload.type === "error" || payload.error) throw new Error(`Speech failed: ${event.data}`);
        if (payload.type === "speech.audio.done") {
          completed = true;
          return;
        }
        if (payload.type !== "speech.audio.delta") return;
        if (completed || !payload.audio) throw new Error("Invalid speech audio event");
        const decoded = decodePCM(
          pending,
          Uint8Array.from(atob(payload.audio), (c) => c.charCodeAt(0)),
        );
        pending = new Uint8Array(decoded.pending);
        if (!decoded.samples.length) return;
        samplesPlayed += decoded.samples.length;
        const buffer = context.createBuffer(1, decoded.samples.length, 24000);
        buffer.copyToChannel(decoded.samples, 0);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(analyser);
        sources.add(source);
        playback = new Promise<void>((resolve) => {
          source.onended = () => {
            sources.delete(source);
            resolve();
          };
        });
        // Device startup can clip audio scheduled exactly at currentTime.
        playhead = Math.max(playhead, context.currentTime + 0.05);
        source.start(playhead);
        playhead += buffer.duration;
      },
    });
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        parser.feed(next.value);
      }
      parser.reset({ consume: true });
    } finally {
      reader.releaseLock();
    }
    if (!completed || !samplesPlayed || pending.length) throw new Error("Incomplete speech stream");
    await playback;
    signal?.throwIfAborted();
  } finally {
    cancelAnimationFrame(raf);
    audioLevel.value = 0; audioLevel.source = "idle";
    signal?.removeEventListener("abort", abort);
    controller.abort();
    for (const source of sources) source.stop();
    analyser.disconnect();
  }
}


/** Play Gemini's 24 kHz mono PCM/WAV response through the unlocked device audio context. */
export async function playSpeechAudio(base64: string, mimeType: string, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const context = unlockAudio();
  if (context.state !== "running") await context.resume();
  signal?.throwIfAborted();
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  let buffer: AudioBuffer;
  if (mimeType.toLowerCase().includes("wav")) {
    buffer = await context.decodeAudioData(bytes.buffer.slice(0));
  } else {
    const pcm = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = Math.floor(bytes.byteLength / 2);
    const samples = new Float32Array(count);
    for (let i = 0; i < count; i++) samples[i] = pcm.getInt16(i * 2, true) / 32768;
    if (!samples.length) throw new Error("Speech engine returned empty audio.");
    buffer = context.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);
  }
  signal?.throwIfAborted();
  const source = context.createBufferSource();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  source.buffer = buffer;
  source.connect(analyser);
  analyser.connect(context.destination);
  const levelBuffer = new Uint8Array(analyser.fftSize);
  let raf = 0;
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      cancelAnimationFrame(raf);
      signal?.removeEventListener("abort", abort);
      audioLevel.value = 0;
      audioLevel.source = "idle";
      try { source.disconnect(); analyser.disconnect(); } catch {}
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error); else resolve();
    };
    const abort = () => { try { source.stop(); } catch {} finish(new DOMException("Cancelled", "AbortError")); };
    const tick = () => {
      audioLevel.value = readLevel(analyser, levelBuffer);
      audioLevel.source = "ai";
      raf = requestAnimationFrame(tick);
    };
    source.onended = () => finish();
    signal?.addEventListener("abort", abort, { once: true });
    tick();
    try { source.start(context.currentTime + 0.04); }
    catch (error) { finish(error instanceof Error ? error : new Error("Audio playback failed.")); }
  });
}
