import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askJarvis } from "@/lib/jarvis.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "J.A.R.V.I.S. — Just A Rather Very Intelligent System" },
      { name: "description", content: "Talk to J.A.R.V.I.S., your personal AI assistant." },
      { property: "og:title", content: "J.A.R.V.I.S. AI Assistant" },
      { property: "og:description", content: "Talk to J.A.R.V.I.S., your personal AI assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Msg = { role: "user" | "assistant"; content: string };

function Core({ size = 220, active = false }: { size?: number; active?: boolean }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/40 animate-spin-slow" />
      <div className="absolute inset-[8%] rounded-full border-[3px] border-transparent border-t-primary border-r-primary/60 animate-spin-rev glow-ring" />
      <div className="absolute inset-[18%] rounded-full border-[3px] border-transparent border-l-primary border-b-primary animate-spin-mid glow-ring" />
      <div className="absolute inset-[18%] rounded-full core-haze" />
      <div className={`absolute inset-[37%] rounded-full core-orb ${active ? "animate-pulse-fast" : "animate-pulse-slow"}`} />
    </div>
  );
}

function Index() {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = useServerFn(askJarvis);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { reply } = await ask({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Connection lost, sir." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!started) {
    return (
      <main className="hud-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Core />
        <h1 className="jarvis-title mt-10 text-4xl sm:text-5xl">J.A.R.V.I.S.</h1>
        <p className="mt-3 tracking-wider text-muted-foreground">Just A Rather Very Intelligent System</p>
        <button onClick={() => setStarted(true)} className="hud-button mt-10">Initialize System</button>
      </main>
    );
  }

  return (
    <main className="hud-bg flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        <Core size={36} active={loading} />
        <div>
          <div className="jarvis-title text-lg">J.A.R.V.I.S.</div>
          <div className="text-xs tracking-widest text-muted-foreground">{loading ? "PROCESSING..." : "ONLINE"}</div>
        </div>
      </header>
      <section className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="mt-16 flex flex-col items-center text-center">
              <Core size={140} />
              <p className="mt-6 text-muted-foreground">Good day, sir. How may I assist you?</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "msg-user" : "msg-ai"}>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
          {loading && <div className="msg-ai text-primary">Analyzing<span className="animate-pulse">...</span></div>}
          <div ref={endRef} />
        </div>
      </section>
      <form onSubmit={send} className="border-t border-border p-4">
        <div className="mx-auto flex max-w-3xl gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Speak to Jarvis..." className="hud-input flex-1" />
          <button disabled={loading} className="hud-button">Send</button>
        </div>
      </form>
    </main>
  );
}
