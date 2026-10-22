import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, MessageSquare, AudioLines } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { askJarvis } from "@/lib/jarvis.functions";
import { transcribeAudio } from "@/lib/transcribe.functions";
import { recordWav } from "@/lib/record-wav";
import { streamSpeech } from "@/lib/stream-speech";
import { audioLevel } from "@/lib/audio-level";
import { SettingsPanel } from "@/components/SettingsPanel";
import { DEFAULT_SETTINGS, type StyxSettings } from "@/lib/styx-settings";
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

function Core({ size = 220, active = false, reactive = false }: { size?: number; active?: boolean; reactive?: boolean }) {
  const r1 = useRef<HTMLDivElement>(null), r2 = useRef<HTMLDivElement>(null), r3 = useRef<HTMLDivElement>(null), orb = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!reactive) return;
    let raf = 0, a = 0, smooth = 0, last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(64, t - last); last = t;
      smooth += (audioLevel.value - smooth) * 0.2;
      const speed = 0.02 + smooth * 0.9 + (active ? 0.08 : 0);
      a += speed * dt;
      if (r1.current) r1.current.style.transform = `rotate(${a * 0.5}deg)`;
      if (r2.current) r2.current.style.transform = `rotate(${-a}deg) scale(${1 + smooth * 0.06})`;
      if (r3.current) r3.current.style.transform = `rotate(${a * 1.6}deg) scale(${1 + smooth * 0.1})`;
      if (orb.current) { orb.current.style.transform = `scale(${1 + smooth * 0.45})`; orb.current.style.filter = `brightness(${1 + smooth * 0.8})`; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reactive, active]);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div ref={r1} className={`absolute inset-0 rounded-full border-2 border-dashed border-primary/40 ${reactive ? "" : "animate-spin-slow"}`} />
      <div ref={r2} className={`absolute inset-[8%] rounded-full border-[3px] border-transparent border-t-primary border-r-primary/60 glow-ring ${reactive ? "" : "animate-spin-rev"}`} />
      <div ref={r3} className={`absolute inset-[18%] rounded-full border-[3px] border-transparent border-l-primary border-b-primary glow-ring ${reactive ? "" : "animate-spin-mid"}`} />
      <div className="absolute inset-[18%] rounded-full core-haze" />
      <div className="core-ripple" />
      <div className="core-ripple core-ripple-2" />
      <div className="absolute inset-[37%]"><div ref={orb} className={`h-full w-full rounded-full core-orb ${reactive ? "" : active ? "animate-pulse-fast" : "animate-pulse-slow"}`} /></div>
    </div>
  );
}

function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [messages, setMessagesState] = useState<Msg[]>([]);
  const messagesRef = useRef<Msg[]>([]);
  const busyRef = useRef(false);
  const setMessages = (m: Msg[]) => { messagesRef.current = m; setMessagesState(m); };
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = useServerFn(askJarvis);
  const transcribe = useServerFn(transcribeAudio);
  const recRef = useRef<{ stop: () => Promise<File> } | null>(null);
  const emptyStreak = useRef(0);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [settings, setSettings] = useState<StyxSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const speechAbort = useRef<AbortController | null>(null);
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [convo, setConvo] = useState(false);
  const convoRef = useRef(false);
  const [phase, setPhase] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");

  async function listen() {
    if (!convoRef.current) return;
    setVoiceError("");
    try {
      setPhase("listening");
      const rec = await recordWav(() => void finishTurn());
      recRef.current = rec;
    } catch { setVoiceError("Microphone access was blocked."); stopConvo(); }
  }

  async function finishTurn() {
    const rec = recRef.current; recRef.current = null;
    if (!rec || !convoRef.current) return;
    setPhase("thinking");
    try {
      const file = await rec.stop();
      const fd = new FormData(); fd.append("file", file);
      const r = await transcribe({ data: fd });
      if (r.error || !r.text?.trim()) {
        if (r.error) setVoiceError(r.error);
        emptyStreak.current += 1;
        if (emptyStreak.current >= 3) {
          setVoiceError("I didn't hear anything, sir. Tap the globe to try again.");
          return void stopConvo();
        }
        return void listen();
      }
      emptyStreak.current = 0;
      const reply = await sendText(r.text, false);
      if (reply && convoRef.current) { setPhase("speaking"); await speak(reply); }
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : "Recording failed.");
    }
    if (convoRef.current) void listen();
  }

  function startConvo() { convoRef.current = true; setConvo(true); emptyStreak.current = 0; void listen(); }
  function stopConvo() {
    convoRef.current = false; setConvo(false); setPhase("idle");
    speechAbort.current?.abort();
    const rec = recRef.current; recRef.current = null;
    rec?.stop().catch(() => {});
    audioLevel.value = 0;
  }
  useEffect(() => () => { convoRef.current = false; speechAbort.current?.abort(); recRef.current?.stop().catch(() => {}); }, []);

  async function speak(text: string, voice = settings.voice) {
    speechAbort.current?.abort();
    const ac = new AbortController();
    speechAbort.current = ac;
    text = text.replace(/[*_#`>|]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    try {
      await streamSpeech("/api/speak", { text, voice }, { Authorization: `Bearer ${token}` }, ac.signal);
    } catch (e) {
      if (!ac.signal.aborted) setVoiceError("Couldn't play the voice reply.");
      console.error(e);
    }
  }

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
    supabase.from("user_settings").select("speak_replies, voice, tone, sensitive").maybeSingle().then(({ data }) => {
      if (data) setSettings(data);
    });
  }, [uid]);

  async function saveSettings(next: StyxSettings) {
    setSettings(next);
    const { error } = await supabase.from("user_settings").upsert({ user_id: uid!, ...next, updated_at: new Date().toISOString() });
    if (error) setVoiceError("Couldn't save settings.");
  }

  async function signIn() {
    setAuthError("");
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setAuthError("Sign-in failed, sir. Please try again.");
  }

  async function clearChat() {
    await supabase.from("messages").delete().eq("user_id", uid!);
    setMessages([]);
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    await sendText(input);
  }

  async function sendText(raw: string, autoSpeak = true): Promise<string | undefined> {
    const text = raw.trim();
    if (!text || busyRef.current) return;
    let result: string | undefined;
    busyRef.current = true;
    const next = [...messagesRef.current, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      await supabase.from("messages").insert({ role: "user", content: text });
      const { reply } = await ask({ data: { messages: next } });
      setMessages([...messagesRef.current, { role: "assistant", content: reply }]);
      await supabase.from("messages").insert({ role: "assistant", content: reply });
      result = reply;
      if (autoSpeak && settings.speak_replies) void speak(reply);
    } catch {
      setMessages([...messagesRef.current, { role: "assistant", content: "Connection lost. Please try again." }]);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
    return result;
  }

  if (!ready) return <main className="hud-bg flex min-h-screen items-center justify-center"><Core /></main>;
  if (!session) {
    return (
      <main className="hud-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="animate-float"><Core /></div>
        <h1 className="jarvis-title animate-rise-in mt-10 text-4xl sm:text-5xl">S.T.Y.X.</h1>
        <p className="animate-rise-in-delay mt-3 tracking-wider text-muted-foreground">Your Personal Intelligent System</p>
        <button onClick={signIn} className="hud-button animate-rise-in-delay-2 mt-10">Continue with Google</button>
        {authError && <p className="mt-4 text-sm text-destructive">{authError}</p>}
      </main>
    );
  }

  return (
    <main className="hud-bg flex h-screen flex-col">
      {showSettings && (
        <SettingsPanel settings={settings} onChange={saveSettings} onClose={() => setShowSettings(false)} onPreview={(v) => speak("Hello. I am Styx, at your service.", v)} />
      )}
      <header className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Core size={36} active={loading} />
        <div>
          <div className="jarvis-title text-base sm:text-lg">S.T.Y.X.</div>
          <div className="text-xs tracking-widest text-muted-foreground">{loading ? "PROCESSING..." : "ONLINE"}</div>
        </div>
        <div className="ml-auto flex shrink-0 gap-3 whitespace-nowrap text-[10px] sm:text-xs tracking-wider text-muted-foreground">
          <button onClick={() => { if (mode === "voice") stopConvo(); setMode(mode === "voice" ? "text" : "voice"); }} className="flex items-center gap-1 hover:text-primary">{mode === "voice" ? <><MessageSquare className="h-3 w-3" />TEXT</> : <><AudioLines className="h-3 w-3" />VOICE</>}</button>
          <button onClick={() => setShowSettings(true)} className="hover:text-primary">SETTINGS</button>
          {messages.length > 0 && <button onClick={clearChat} className="hover:text-primary">CLEAR</button>}
          <button onClick={() => supabase.auth.signOut()} className="hover:text-primary">SIGN OUT</button>
        </div>
      </header>
      {mode === "voice" ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden px-6 text-center">
          <button onClick={convo ? stopConvo : startConvo} aria-label={convo ? "End conversation" : "Start talking"} className="rounded-full">
            <Core size={260} reactive active={phase === "thinking"} />
          </button>
          <div className="text-sm tracking-[0.3em] text-primary">
            {phase === "listening" ? "LISTENING..." : phase === "thinking" ? "THINKING..." : phase === "speaking" ? "SPEAKING..." : "TAP THE CORE TO TALK"}
          </div>
          {messages.length > 0 && (
            <p className="line-clamp-3 max-w-md text-sm text-muted-foreground">{messages[messages.length - 1]!.content.replace(/[*_#`]/g, "")}</p>
          )}
          <div className="flex gap-3">
            {phase === "listening" && <button onClick={() => void finishTurn()} className="hud-button">Done speaking</button>}
            {convo && <button onClick={stopConvo} className="hud-mic hud-mic-on" aria-label="End conversation"><Square className="h-4 w-4 fill-current" /></button>}
          </div>
          {voiceError && <p className="text-sm text-destructive">{voiceError}</p>}
        </section>
      ) : (<>
      <section className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="animate-fade-in mt-16 flex flex-col items-center text-center">
              <div className="animate-float"><Core size={140} /></div>
              <p className="mt-6 text-muted-foreground">Good day, sir. How may I assist you?</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "msg-user" : "msg-ai"}>
              {m.role === "assistant" ? <div className="md"><ReactMarkdown>{m.content}</ReactMarkdown></div> : <p className="whitespace-pre-wrap">{m.content}</p>}
              {m.role === "assistant" && <button onClick={() => speak(m.content)} className="mt-1 text-xs tracking-widest text-muted-foreground hover:text-primary">▶ PLAY</button>}
            </div>
          ))}
          {loading && <div className="msg-ai"><span className="typing"><span /><span /><span /></span></div>}
          <div ref={endRef} />
        </div>
      </section>
      <form onSubmit={send} className="border-t border-border p-4">
        <div className="mx-auto flex max-w-3xl gap-2">
          <button type="button" onClick={toggleMic} disabled={loading || transcribing} aria-label={recording ? "Stop recording" : "Speak"} className={recording ? "hud-mic hud-mic-on" : "hud-mic"}>
            {transcribing ? <Loader2 className="h-5 w-5 animate-spin" /> : recording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={recording ? "Listening..." : "Type or tap the mic..."} className="hud-input min-w-0 flex-1" />
          <button disabled={loading} className="hud-button">Send</button>
        </div>
        {voiceError && <p className="mx-auto mt-2 max-w-3xl text-sm text-destructive">{voiceError}</p>}
      </form>
      </>)}
    </main>
  );
}
