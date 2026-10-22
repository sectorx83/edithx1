// Shared live audio level (0..1) that drives the core animation.
export const audioLevel = { value: 0, source: "idle" as "idle" | "mic" | "ai" };
export function readLevel(analyser: AnalyserNode, buf: Uint8Array<ArrayBuffer>) {
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) { const v = (buf[i]! - 128) / 128; sum += v * v; }
  return Math.min(1, Math.sqrt(sum / buf.length) * 4);
}
