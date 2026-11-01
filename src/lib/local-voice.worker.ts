import { env, pipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
const loadRecognizer = () => pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny.en", { device: "wasm", dtype: "q8" });
let recognizer: ReturnType<typeof loadRecognizer> | undefined;

self.onmessage = async (event: MessageEvent<{ id: number; audio: Float32Array }>) => {
  try {
    recognizer ??= loadRecognizer();
    const engine = await recognizer;
    const output = await engine(event.data.audio, { chunk_length_s: 30, stride_length_s: 5 });
    const text = Array.isArray(output) ? output.map((part) => part.text).join(" ") : output.text;
    self.postMessage({ id: event.data.id, text: text.trim() });
  } catch {
    recognizer = undefined;
    self.postMessage({ id: event.data.id, error: "Couldn't load the device speech engine. Check your connection and try again, sir." });
  }
};