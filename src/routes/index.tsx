import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askJarvis } from "@/lib/jarvis.functions";
import { transcribeAudio } from "@/lib/transcribe.functions";
import { recordWav } from "@/lib/record-wav";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "S.T.Y.X. — Your Personal Intelligent System" },
      { name: "description", content: "Talk to S.T.Y.X., your personal AI assistant." },
      { property: "og:title", content: "S.T.Y.X. AI Assistant" },
      { property: "og:description", content: "Talk to S.T.Y.X., your personal AI assistant." },
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
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = useServerFn(askJarvis);
  const transcribe = useServerFn(transcribeAudio);
  const recRef = useRef<{ stop: () => Promise<File> } | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  async function toggleMic() {
    setVoiceError("");
    if (!recording) {
      try { recRef.current = await recordWav(); setRecording(true); }
      catch { setVoiceError("Microphone access was blocked."); }
      return;
    }
    setRecording(false);
    setTranscribing(true);
    try {
      const file = await recRef.current!.stop();
      const fd = new FormData(); fd.append("file", file);
      const r = await transcribe({ data: fd });
      if (r.error) setVoiceError(r.error);
      else if (r.text) await sendText(r.text);
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : "Recording failed.");
    } finally { setTranscribing(false); }
  }
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) { setMessages([]); return; }
    supabase.from("messages").select("role, content").order("created_at").then(({ data }) => {
      if (data) setMessages(data as Msg[]);
    });
  }, [uid]);

  async function signIn() {
    setAuthError("");
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setAuthError("Sign-in failed, sir. Please try again.");
  }

  async function clearChat() {
    await supabase.from("messages").delete().eq("user_id", uid!);
    setMessages([]);
  }

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    await sendText(input);
  }

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      await supabase.from("messages").insert({ role: "user", content: text });
      const { reply } = await ask({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: reply }]);
      await supabase.from("messages").insert({ role: "assistant", content: reply });
    } catch {
      setMessages([...next, { role: "assistant", content: "Connection lost, sir." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <main className="hud-bg flex min-h-screen items-center justify-center"><Core /></main>;
  if (!session) {
    return (
      <main className="hud-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Core />
        <h1 className="jarvis-title mt-10 text-4xl sm:text-5xl">S.T.Y.X.</h1>
        <p className="mt-3 tracking-wider text-muted-foreground">Your Personal Intelligent System</p>
        <button onClick={signIn} className="hud-button mt-10">Continue with Google</button>
        {authError && <p className="mt-4 text-sm text-destructive">{authError}</p>}
      </main>
    );
  }

  return (
    <main className="hud-bg flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        <Core size={36} active={loading} />
        <div>
          <div className="jarvis-title text-lg">S.T.Y.X.</div>
          <div className="text-xs tracking-widest text-muted-foreground">{loading ? "PROCESSING..." : "ONLINE"}</div>
        </div>
        <div className="ml-auto flex gap-3 text-xs tracking-widest text-muted-foreground">
          {messages.length > 0 && <button onClick={clearChat} className="hover:text-primary">CLEAR</button>}
          <button onClick={() => supabase.auth.signOut()} className="hover:text-primary">SIGN OUT</button>
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
          <button type="button" onClick={toggleMic} disabled={loading || transcribing} aria-label={recording ? "Stop recording" : "Speak"} className={recording ? "hud-mic hud-mic-on" : "hud-mic"}>
            {transcribing ? "…" : recording ? "■" : "🎙"}
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={recording ? "Listening..." : "Type or tap the mic..."} className="hud-input flex-1" />
          <button disabled={loading} className="hud-button">Send</button>
        </div>
        {voiceError && <p className="mx-auto mt-2 max-w-3xl text-sm text-destructive">{voiceError}</p>}
      </form>
    </main>
  );
}
