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
export function unlockAudio() {
  if (!shared || shared.state === "closed") shared = new AudioContext({ sampleRate: 24000 });
  void shared.resume().catch(() => {});
  const b = shared.createBuffer(1, 1, 24000); const s = shared.createBufferSource(); s.buffer = b; s.connect(shared.destination); s.start();
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
