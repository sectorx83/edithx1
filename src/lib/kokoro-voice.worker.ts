import { env, pipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;

let synthesizer: ReturnType<typeof pipeline> | undefined;

self.onmessage = async (event: MessageEvent<{ id: number; text: string; voice?: string }>) => {
  const { id, text, voice } = event.data;
  try {
    synthesizer ??= pipeline("text-to-speech", "onnx-community/Kokoro-82M-v1.0-ONNX", {
      device: "wasm",
      dtype: "q8",
    });
    const engine = await synthesizer;
    const result = await engine(text, { voice: voice || "am_michael" }) as { audio: Float32Array; sampling_rate: number };
    const audio = result.audio instanceof Float32Array ? result.audio : new Float32Array(result.audio);
    const transferable = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength);
    self.postMessage({ id, audio: transferable, sampleRate: result.sampling_rate || 24000 }, [transferable]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "Kokoro could not generate speech." });
  }
};
