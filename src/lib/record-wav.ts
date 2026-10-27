export function encodeWav(chunks: readonly Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new ArrayBuffer(44 + length * 2);
  const view = new DataView(bytes);
  const tag = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  for (const chunk of chunks)
    for (const value of chunk) {
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(offset, sample * (sample < 0 ? 32768 : 32767), true);
      offset += 2;
    }
  return new Blob([bytes], { type: "audio/wav" });
}

import { audioLevel } from "@/lib/audio-level";

/** onSilence fires once after speech was heard and then ~1.3s of quiet. */
export async function recordWav(onSilence?: () => void): Promise<{ stop: () => Promise<File> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let context: AudioContext | undefined;
  try {
    try { context = new AudioContext({ sampleRate: 16000 }); context.createMediaStreamSource(stream).disconnect(); }
    catch { await context?.close().catch(() => {}); context = new AudioContext(); }
    await Promise.race([context.resume(), new Promise((r) => setTimeout(r, 1000))]);
    const audioContext = context;
    const source = audioContext.createMediaStreamSource(stream);
    const node = audioContext.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    let heard = false, quietMs = 0, fired = false, speechMs = 0;
    node.onaudioprocess = (event) => {
      const data = event.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(data));
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i]! * data[i]!;
      const lvl = Math.min(1, Math.sqrt(sum / data.length) * 6);
      audioLevel.value = lvl; audioLevel.source = "mic";
      const ms = (data.length / audioContext.sampleRate) * 1000;
      if (lvl > 0.12) { heard = true; quietMs = 0; speechMs += ms; } else if (heard) quietMs += ms;
      // Auto-send only after real speech (>= 0.5s total) followed by ~1.3s of quiet,
      // so background noise or a brief tap on the mic never fires a send.
      if (heard && speechMs >= 500 && quietMs > 1300 && !fired) { fired = true; onSilence?.(); }
    };
    source.connect(node);
    node.connect(audioContext.destination);
    let stopped = false;
    return {
      async stop() {
        if (stopped) throw new Error("Recording already stopped");
        stopped = true;
        stream.getTracks().forEach((track) => track.stop());
        node.disconnect();
        source.disconnect();
        node.onaudioprocess = null;
        audioLevel.value = 0; audioLevel.source = "idle";
        const blob = encodeWav(chunks, audioContext.sampleRate);
        await audioContext.close();
        if (blob.size < 2048) throw new Error("Recording was empty; please record again");
        return new File([blob], "recording.wav", { type: "audio/wav" });
      },
    };
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    await context?.close();
    throw error;
  }
}
