import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, MessageSquare, AudioLines, Settings, Activity, LayoutDashboard, BrainCircuit, Wrench, Clock3, ArrowUpRight, Zap, ShieldCheck, Radio, Server, Sparkles, Music, Play, Pause, SkipBack, SkipForward, Volume2, Upload, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { askJarvis, type NetworkPayload } from "@/lib/jarvis.functions";
import { TaskPanel } from "@/components/TaskPanel";
import { getNetworkStatus, reportBrowserAction } from "@/lib/styx-network.functions";
import { transcribeLocal, speakLocal, cancelLocalTranscription } from "@/lib/local-voice";
import { recordWav } from "@/lib/record-wav";
import { unlockAudio } from "@/lib/stream-speech";
import { audioLevel } from "@/lib/audio-level";
import { SettingsPanel } from "@/components/SettingsPanel";
import { DEFAULT_SETTINGS, type StyxSettings } from "@/lib/styx-settings";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { isUnlocked } = await import("@/lib/gate.functions");
    const { unlocked } = await isUnlocked();
    if (!unlocked) throw redirect({ to: "/unlock" });
  },
  head: () => ({
    meta: [
      { title: "EDITH X1" },
      { name: "description", content: "Talk to E.D.I.T.H., your personal AI assistant." },
      { property: "og:title", content: "EDITH X1" },
      { property: "og:description", content: "Talk to E.D.I.T.H., your personal AI assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Msg = { role: "user" | "assistant"; content: string; network?: NetworkPayload | undefined };

function formatAudioTime(value: number) { if (!Number.isFinite(value)) return "0:00"; const mins = Math.floor(value / 60); const secs = Math.floor(value % 60); return `${mins}:${String(secs).padStart(2, "0")}`; }

function Core({ size = 220, active = false, reactive = false }: { size?: number; active?: boolean; reactive?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    if (!reactive || !canvas.current) return;
    const element = canvas.current;
    const gl = element.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) return;
    const vertexSource = `
      attribute vec2 position;
      varying vec2 vUv;
      void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
    `;
    const fragmentSource = `
      precision highp float;
      varying vec2 vUv;
      uniform vec2 resolution;
      uniform float time;
      uniform float energy;
      float smoothUnion(float a, float b, float k) {
        float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
      }
      float blob(vec3 p, vec3 center, vec3 radius) {
        vec3 q = (p - center) / radius;
        return (length(q) - 1.0) * min(radius.x, min(radius.y, radius.z));
      }
      float scene(vec3 p) {
        float t = time;
        float speed = 0.48 + energy * 2.9;
        vec3 warp = vec3(
          sin(p.y * 4.4 + t * speed) * 0.055,
          cos(p.z * 4.0 - t * speed * 0.8) * 0.06,
          sin(p.x * 4.8 + t * speed * 0.65) * 0.05
        ) * (0.45 + energy * 1.6);
        vec3 q = p + warp;
        float a = blob(q, vec3(sin(t*.73)*.15, cos(t*.61)*.13, sin(t*.49)*.08), vec3(.72,.69,.68));
        float b = blob(q, vec3(sin(t*.52+2.0)*.43, sin(t*.81+1.2)*.36, cos(t*.57)*.24), vec3(.51,.53,.56));
        float c = blob(q, vec3(cos(t*.64+3.1)*.44, sin(t*.55+3.0)*.42, sin(t*.72+2.0)*.2), vec3(.47,.5,.51));
        float d = blob(q, vec3(sin(t*.9+1.0)*.3, cos(t*.7+4.0)*.51, cos(t*.6+2.0)*.28), vec3(.38,.43,.4));
        float fluid = smoothUnion(a,b,.34 + energy*.1);
        fluid = smoothUnion(fluid,c,.32 + energy*.11);
        fluid = smoothUnion(fluid,d,.29 + energy*.1);
        return fluid - (0.012 + energy*.025) * sin(p.x*8.0+t*speed) * sin(p.y*7.0-t*speed*.8) * sin(p.z*8.0+t*speed*.7);
      }
      vec3 normalAt(vec3 p) {
        vec2 e = vec2(.0025,0.0);
        return normalize(vec3(
          scene(p+e.xyy)-scene(p-e.xyy),
          scene(p+e.yxy)-scene(p-e.yxy),
          scene(p+e.yyx)-scene(p-e.yyx)
        ));
      }
      void main() {
        vec2 uv = (gl_FragCoord.xy - .5 * resolution) / min(resolution.x,resolution.y);
        vec3 ro = vec3(0.0,0.0,3.05);
        vec3 rd = normalize(vec3(uv, -1.9));
        float travel = 0.0;
        float distanceField = 0.0;
        bool hit = false;
        vec3 p;
        for (int i=0; i<88; i++) {
          p = ro + rd * travel;
          distanceField = scene(p);
          if (distanceField < .0025) { hit = true; break; }
          travel += max(distanceField * .72, .006);
          if (travel > 6.0) break;
        }
        vec3 color = vec3(0.0);
        if (hit) {
          vec3 n = normalAt(p);
          vec3 light = normalize(vec3(-.55,.8,1.2));
          vec3 view = normalize(ro-p);
          float diffuse = max(dot(n,light),0.0);
          float spec = pow(max(dot(reflect(-light,n),view),0.0), 42.0);
          float rim = pow(1.0-max(dot(n,view),0.0), 2.35);
          float edge = pow(1.0-abs(dot(n,view)), 3.5);
          float liquidFlow = .5 + .5*sin(p.x*8.0+p.y*5.0-time*(.8+energy*3.0));
          color = vec3(.035,.035,.04) + vec3(.34,.35,.38)*diffuse*.72;
          color += vec3(.42,.46,.52)*spec*.72;
          color += vec3(.38,.43,.52)*rim*(.28+energy*.42);
          color += vec3(.22,.26,.32)*edge*(.08+liquidFlow*.16+energy*.18);
        }
        float vignette = smoothstep(1.45,.18,length(uv));
        color *= vignette;
        color = min(color, vec3(.78,.82,.9));
        gl_FragColor = vec4(color, hit ? .96 : 0.0);
      }
    `;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const resolution = gl.getUniformLocation(program,"resolution");
    const timeUniform = gl.getUniformLocation(program,"time");
    const energyUniform = gl.getUniformLocation(program,"energy");
    let raf = 0, start = performance.now(), previous = start, smooth = 0, elapsed = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(element.clientWidth*dpr));
      const height = Math.max(1, Math.round(element.clientHeight*dpr));
      if (element.width !== width || element.height !== height) {
        element.width = width; element.height = height; gl.viewport(0,0,width,height);
      }
    };
    const loop = (now: number) => {
      resize();
      const dt = Math.min(48, now-previous); previous=now;
      const target = Math.min(1,audioLevel.value);
      smooth += (target-smooth) * (target>smooth ? .24 : .055);
      const drive = Math.max(smooth, activeRef.current ? .025 : 0);
      elapsed += dt * (.00034 + drive*.0029);
      gl.viewport(0, 0, element.width, element.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(resolution,element.width,element.height);
      gl.uniform1f(timeUniform,elapsed);
      gl.uniform1f(energyUniform,drive);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); gl.getExtension("WEBGL_lose_context")?.loseContext(); };
  }, [reactive]);
  return (
    <div className="core-fluid relative" style={{ width: size, height: size }}>
      <div className="core-fluid-halo" />
      <div className="core-fluid-edge" />
      <canvas ref={canvas} className="core-fluid-canvas" aria-label="Live flowing liquid core" />
      {!reactive && <div className="core-fluid-idle" />}
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
  const voiceTurnRef = useRef(false);
  const setMessages = (m: Msg[]) => { messagesRef.current = m; setMessagesState(m); };
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = useServerFn(askJarvis);
  const recRef = useRef<{ stop: () => Promise<File> } | null>(null);
  const emptyStreak = useRef(0);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [settings, setSettings] = useState<StyxSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const speechAbort = useRef<AbortController | null>(null);
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [dashboard, setDashboard] = useState(true);
  const [missionInput, setMissionInput] = useState("");
  const [missionRunning, setMissionRunning] = useState(false);
  const [missionStatus, setMissionStatus] = useState<"idle" | "dispatching" | "completed" | "failed">("idle");
  const [missionDuration, setMissionDuration] = useState<number | null>(null);
  const lastNetworkResult = useRef<NetworkPayload | undefined>(undefined);
  const [localNow, setLocalNow] = useState(() => new Date());
  const [convo, setConvo] = useState(false);
  const convoRef = useRef(false);
  const [phase, setPhase] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const fetchNetStatus = useServerFn(getNetworkStatus);
  const reportAction = useServerFn(reportBrowserAction);
  type NetStatus = { status: "connecting" | "connected" | "disconnected"; error?: string | undefined; tools: { name: string; description: string }[]; misconfigured: { name: string; reason: string; setup: string }[]; unavailable: { name: string; reason: string }[] };
  const [net, setNet] = useState<NetStatus>({ status: "connecting", tools: [], misconfigured: [], unavailable: [] });
  const [showNet, setShowNet] = useState(false);
  type MusicTrack = { id: string; title: string; artist: string; src: string; youtubeId?: string; file?: File };
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [musicIndex, setMusicIndex] = useState(0);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicProgress, setMusicProgress] = useState(0);
  const [musicDuration, setMusicDuration] = useState(0);
  const [musicVolume, setMusicVolume] = useState(0.8);
  const [musicUrl, setMusicUrl] = useState("");
  const [musicError, setMusicError] = useState("");
  const musicAudio = useRef<HTMLAudioElement | null>(null);
  const youtubePlayer = useRef<any>(null);
  const youtubeHost = useRef<HTMLDivElement | null>(null);
  const activeTrack = musicTracks[musicIndex];

  function addMusicFiles(files: FileList | null) {
    if (!files?.length) return;
    const accepted = Array.from(files).filter((file) => file.type.startsWith("audio/"));
    if (!accepted.length) { setMusicError("Choose an audio file such as MP3, WAV, M4A or OGG."); return; }
    const added = accepted.map((file) => ({ id: crypto.randomUUID(), title: file.name.replace(/\\.[^.]+$/, ""), artist: "Local file", src: URL.createObjectURL(file), file }));
    setMusicTracks((current) => [...current, ...added]);
    setMusicError("");
    if (!musicTracks.length) setMusicIndex(0);
  }
  function extractYouTubeId(value: string) {
    try {
      const url = new URL(value);
      if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
      if (url.hostname.endsWith("youtube.com") || url.hostname.endsWith("youtube-nocookie.com")) {
        if (url.pathname === "/watch") return url.searchParams.get("v");
        const parts = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] || null;
      }
    } catch { /* not a URL */ }
    return null;
  }
  async function addMusicUrl() {
    const value = musicUrl.trim();
    const youtubeId = extractYouTubeId(value);
    if (youtubeId) {
      const track: MusicTrack = { id: crypto.randomUUID(), title: "YouTube video", artist: "YouTube", src: "", youtubeId };
      try {
        const response = await fetch("https://www.youtube.com/oembed?url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + youtubeId) + "&format=json");
        if (response.ok) { const meta = await response.json(); track.title = meta.title || track.title; track.artist = meta.author_name || "YouTube"; }
      } catch { /* The player still works if metadata lookup is blocked. */ }
      setMusicTracks((current) => [...current, track]);
      setMusicUrl("");
      setMusicError("");
      if (musicTracks.length === 0) setMusicIndex(0);
      return;
    }
    if (!value.startsWith("https://")) { setMusicError("Paste a YouTube video link or a direct HTTPS audio URL."); return; }
    const title = value.split("/").pop()?.split("?")[0] || "Audio stream";
    setMusicTracks((current) => [...current, { id: crypto.randomUUID(), title: decodeURIComponent(title), artist: "Online audio", src: value }]);
    setMusicUrl("");
    setMusicError("");
  }
  async function toggleMusic() {
    if (!activeTrack) return;
    if (activeTrack.youtubeId) {
      if (!youtubePlayer.current) { setMusicError("YouTube player is loading. Try again in a moment."); return; }
      if (musicPlaying) youtubePlayer.current.pauseVideo(); else youtubePlayer.current.playVideo();
      setMusicPlaying(!musicPlaying);
      return;
    }
    const audio = musicAudio.current;
    if (!audio) return;
    try {
      if (musicPlaying) { audio.pause(); setMusicPlaying(false); }
      else { await audio.play(); setMusicPlaying(true); setMusicError(""); }
    } catch { setMusicPlaying(false); setMusicError("This audio source could not be played. Try another file or direct audio URL."); }
  }
  function changeMusic(next: number) {
    if (!musicTracks.length) return;
    setMusicIndex((next + musicTracks.length) % musicTracks.length);
    setMusicProgress(0);
    setMusicPlaying(false);
  }
  useEffect(() => {
    const audio = musicAudio.current;
    if (!audio || activeTrack?.youtubeId) return;
    audio.volume = musicVolume;
    if (musicPlaying) void audio.play().catch(() => { setMusicPlaying(false); setMusicError("Playback failed for this track."); });
  }, [musicIndex, musicTracks, musicVolume, musicPlaying, activeTrack?.youtubeId]);
  useEffect(() => {
    if (!activeTrack?.youtubeId || !youtubeHost.current) return;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !youtubeHost.current || !(window as any).YT?.Player) return;
      youtubePlayer.current?.destroy?.();
      youtubePlayer.current = new (window as any).YT.Player(youtubeHost.current, {
        width: "100%", height: "180", videoId: activeTrack.youtubeId,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
        events: {
          onReady: (event: any) => { event.target.setVolume(Math.round(musicVolume * 100)); if (musicPlaying) event.target.playVideo(); },
          onStateChange: (event: any) => {
            const YT = (window as any).YT;
            if (event.data === YT.PlayerState.PLAYING) setMusicPlaying(true);
            if (event.data === YT.PlayerState.PAUSED) setMusicPlaying(false);
            if (event.data === YT.PlayerState.ENDED) { setMusicPlaying(false); setMusicProgress(0); changeMusic(musicIndex + 1); }
          },
          onError: () => { setMusicPlaying(false); setMusicError("YouTube could not play this video. It may be private, restricted, or unavailable for embedding."); }
        }
      });
    };
    if ((window as any).YT?.Player) mount();
    else {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
      if (!existing) { const script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(script); }
      const previous = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => { previous?.(); mount(); };
    }
    return () => { cancelled = true; youtubePlayer.current?.destroy?.(); youtubePlayer.current = null; };
  }, [activeTrack?.youtubeId]);
  useEffect(() => { if (youtubePlayer.current && activeTrack?.youtubeId) youtubePlayer.current.setVolume(Math.round(musicVolume * 100)); }, [musicVolume, activeTrack?.youtubeId]);
  useEffect(() => () => { musicTracks.forEach((track) => { if (track.file) URL.revokeObjectURL(track.src); }); }, []);

  async function listen() {
    if (!convoRef.current) return;
    setVoiceError("");
    try {
      setPhase("listening");
      const rec = await recordWav(() => void finishTurn());
      if (!convoRef.current) { await rec.stop(); return; }
      recRef.current = rec;
    } catch { setVoiceError("Microphone access was blocked."); stopConvo(); }
  }

  async function finishTurn() {
    if (voiceTurnRef.current) return;
    const rec = recRef.current;
    if (!rec || !convoRef.current) return;
    voiceTurnRef.current = true;
    recRef.current = null;
    setPhase("thinking");
    try {
      const file = await rec.stop();
      if (!convoRef.current) return;
      const r = await transcribeLocal(file);
      if (!convoRef.current) return;
      if (r.error || !r.text?.trim()) {
        if (r.error) setVoiceError(r.error);
        emptyStreak.current += 1;
        if (emptyStreak.current >= 3) {
          setVoiceError("I didn't hear anything. Tap the core to restart voice chat.");
          stopConvo();
          return;
        }
        return;
      }
      emptyStreak.current = 0;
      const reply = await sendText(r.text, false);
      if (reply && convoRef.current) {
        setPhase("speaking");
        await speak(reply);
      }
    } catch (e) {
      if (convoRef.current) setVoiceError(e instanceof Error ? e.message : "Voice processing failed. Try again.");
    } finally {
      voiceTurnRef.current = false;
      if (convoRef.current) void listen();
    }
  }

  function startConvo() {
    unlockAudio();
    speechAbort.current?.abort();
    convoRef.current = true;
    setConvo(true);
    setPhase("idle");
    setVoiceError("");
    emptyStreak.current = 0;
    void listen();
  }

  function stopConvo() {
    convoRef.current = false;
    setConvo(false);
    setPhase("idle");
    speechAbort.current?.abort();
    cancelLocalTranscription();
    const rec = recRef.current;
    recRef.current = null;
    rec?.stop().catch(() => {});
    audioLevel.value = 0;
  }

  function switchMode(next: "voice" | "text") {
    if (next === mode) return;
    // Tear down every voice task before changing the stage so no stale recorder,
    // transcription, or speech callback can keep the previous mode alive.
    convoRef.current = false;
    setConvo(false);
    setPhase("idle");
    speechAbort.current?.abort();
    cancelLocalTranscription();
    const rec = recRef.current;
    recRef.current = null;
    rec?.stop().catch(() => {});
    setRecording(false);
    setTranscribing(false);
    setVoiceError("");
    audioLevel.value = 0;
    setShowNet(false);
    setMode(next);
  }
  useEffect(() => () => { convoRef.current = false; speechAbort.current?.abort(); cancelLocalTranscription(); recRef.current?.stop().catch(() => {}); }, []);

  async function speak(text: string, voice = settings.voice) {
    speechAbort.current?.abort();
    const ac = new AbortController();
    speechAbort.current = ac;
    text = text.replace(/[*_#`>|]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1");
    try {
      await speakLocal(text, voice, ac.signal);
    } catch (e) {
      if (!ac.signal.aborted) setVoiceError(e instanceof Error ? e.message : "Couldn't play the device voice, sir.");
    }
  }

  async function toggleMic() {
    unlockAudio();
    setVoiceError("");
    if (!recording) {
      try { recRef.current = await recordWav(() => void toggleMic()); setRecording(true); }
      catch { setVoiceError("Microphone access was blocked."); }
      return;
    }
    setRecording(false);
    setTranscribing(true);
    try {
      const rec = recRef.current; recRef.current = null;
      if (!rec) return;
      const file = await rec.stop();
      const r = await transcribeLocal(file);
      if (r.error) setVoiceError(r.error);
      else if (r.text) await sendText(r.text);
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : "Recording failed.");
    } finally { setTranscribing(false); }
  }
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setLocalNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function launchMission(e: React.FormEvent) {
    e.preventDefault();
    const goal = missionInput.trim();
    if (!goal || missionRunning || loading) return;
    const started = Date.now();
    setMissionRunning(true);
    setMissionStatus("dispatching");
    setMissionDuration(null);
    lastNetworkResult.current = undefined;
    setMissionInput("");
    try {
      const reply = await sendText(
        "You are EDITH X1 Agent. Mission objective: " + goal +
        "\\nCreate an ordered plan, then execute relevant actions supported by EDITH NETWORK. Prefer one multi-step execute_task directive. Verify returned results and report each step as completed, failed, or skipped with evidence. Never claim actions without tool confirmation. Ask before irreversible, financial, account-changing, or sensitive actions. Clearly explain unsupported steps."
      );
      const execution = lastNetworkResult.current;
      const hasFailedStep = execution?.steps?.some((step) => step.status === "failed") ?? false;
      const networkFailed = Boolean(execution?.error) || execution?.taskStatus === "failed" || hasFailedStep;
      const transportFailed = !reply || reply.startsWith("Connection lost.");
      setMissionStatus(networkFailed || transportFailed ? "failed" : "completed");
    } catch {
      setMissionStatus("failed");
    } finally {
      setMissionDuration(Math.max(1, Math.round((Date.now() - started) / 1000)));
      setMissionRunning(false);
    }
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local device time";
  const clockTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(localNow);
  const clockDate = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(localNow);
  const timezoneOffset = new Intl.DateTimeFormat(undefined, { timeZoneName: "shortOffset" }).formatToParts(localNow).find((part) => part.type === "timeZoneName")?.value ?? "Local";
  const latestMission = [...messages].reverse().find((m) => m.network?.steps?.length)?.network;

  useEffect(() => {
    let alive = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (alive) setSession(nextSession);
    });

    async function establishSingleUserSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session) {
          if (alive) setSession(data.session);
        } else {
          // Password gate protects the app; Supabase anonymous auth supplies
          // the per-browser identity used by existing database policies.
          const result = await supabase.auth.signInAnonymously();
          if (result.error || !result.data.session) {
            throw result.error ?? new Error("Anonymous sign-in did not return a session");
          }
          if (alive) setSession(result.data.session);
        }
      } catch (error) {
        if (alive) setAuthError(
          error instanceof Error
            ? error.message
            : "Could not start the private session. Enable Anonymous Sign-Ins in Supabase Auth.",
        );
      } finally {
        if (alive) setReady(true);
      }
    }

    void establishSingleUserSession();
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Poll EDITH NETWORK status; states come from real backend responses.
  useEffect(() => {
    if (!session) return;
    let dead = false;
    const check = async () => {
      try {
        const r = await fetchNetStatus();
        if (!dead) setNet({ status: r.status, error: r.error, tools: r.tools, misconfigured: r.misconfigured, unavailable: r.unavailable });
      } catch {
        if (!dead) setNet((n) => ({ ...n, status: "disconnected", error: "Status check failed" }));
      }
    };
    void check();
    const t = setInterval(check, 60000);
    return () => { dead = true; clearInterval(t); };
  }, [session, fetchNetStatus]);

  // Open a Network browser_action in a new tab and report the real result.
  async function handleBrowserAction(n: { browserAction?: { url: string; target?: string } | undefined; reportUrl?: string | undefined; actionId?: string | undefined }) {
    const ba = n.browserAction;
    if (!ba?.url || !/^https:\/\//i.test(ba.url)) return;
    const win = window.open(ba.url, "_blank", "noopener,noreferrer");
    const opened = !!win;
    if (n.reportUrl && n.actionId) {
      try { await reportAction({ data: { reportUrl: n.reportUrl, actionId: n.actionId, success: opened } }); } catch { /* reporting is best-effort */ }
    }
    const note = opened
      ? `Opened ${new URL(ba.url).hostname} in a new tab.`
      : `Your browser blocked the new tab. Allow popups for this site, or open it manually: ${ba.url}`;
    setMessages([...messagesRef.current, { role: "assistant", content: note }]);
  }

  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) { setMessages([]); return; }
    supabase.from("messages").select("role, content, network").order("created_at").then(({ data }) => {
      if (data) setMessages(data.map((d) => ({ role: d.role as Msg["role"], content: d.content, network: (d.network as NetworkPayload | null) ?? undefined })));
    });
    supabase.from("user_settings").select("speak_replies, voice, tone, sensitive").maybeSingle().then(({ data }) => {
      if (data) setSettings(data);
    });
  }, [uid]);

  async function saveSettings(next: StyxSettings) {
    if (!uid) return;
    setSettings(next);
    const { error } = await supabase.from("user_settings").upsert({ user_id: uid, ...next, updated_at: new Date().toISOString() });
    if (error) setVoiceError("Couldn't save settings.");
  }

  async function clearChat() {
    if (!uid) return;
    await supabase.from("messages").delete().eq("user_id", uid);
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
      const { reply, network } = await ask({ data: { messages: next } });
      lastNetworkResult.current = network;
      setMessages([...messagesRef.current, { role: "assistant", content: reply, network }]);
      await supabase.from("messages").insert({ role: "assistant", content: reply, network: network ? JSON.parse(JSON.stringify(network)) : null });
      if (network?.browserAction) void handleBrowserAction(network);
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
        <h1 className="jarvis-title mt-10 text-4xl sm:text-5xl">E.D.I.T.H.</h1>
        <p className="mt-3 tracking-wider text-muted-foreground">Private session unavailable</p>
        <p className="mt-4 max-w-md text-sm text-destructive">
          {authError || "Enable Anonymous Sign-Ins in Supabase Authentication settings, then reload EDITH."}
        </p>
      </main>
    );
  }

  return (
    <main className="hud-bg app-shell flex h-dvh flex-col">
      {showSettings && (
        <SettingsPanel settings={settings} onChange={saveSettings} onClose={() => setShowSettings(false)} onPreview={(v) => speak("Hello. I am EDITH, at your service.", v)} />
      )}
      <header className="glass-panel app-header flex items-center gap-3 border-b border-border px-5 py-3">
        <Core size={38} active={loading} />
        <div className="min-w-0">
          <div className="jarvis-title text-base sm:text-lg">EDITH X1</div>
          <div className="text-[10px] tracking-[0.28em] text-muted-foreground">{loading ? "PROCESSING" : "PERSONAL AI SYSTEM"}</div>
        </div>
        <span className="ml-auto hidden text-[10px] tracking-[0.22em] text-muted-foreground sm:block">BLACK GLASS INTERFACE</span>
        <button type="button" onClick={() => setShowNet((open) => !open)} className={showNet ? "signal-button is-active" : "signal-button"} aria-label="Open network signal status" aria-expanded={showNet}>
          <Activity className="h-7 w-7" strokeWidth={2.1} />
          <span className={`signal-status signal-${net.status}`} />
        </button>
      </header>

      {dashboard ? (
        <section className="edith-dashboard">
          <div className="dashboard-heading">
            <div><div className="dashboard-eyebrow">PERSONAL INTELLIGENCE SYSTEM</div><h1>Good day. <span>EDITH is ready.</span></h1><p>Your command centre is standing by.</p></div>
            <div className="dashboard-live"><i className={net.status === "connected" ? "is-online" : ""} /> SYSTEM {net.status.toUpperCase()}</div>
          </div>
          <div className="dashboard-grid">
            <article className="dashboard-card dashboard-core-card">
              <div className="dashboard-card-top"><span>EDITH CORE</span><span className="dashboard-live-label">{loading ? "PROCESSING" : phase.toUpperCase()}</span></div>
              <button className="dashboard-core-button" onClick={() => { setDashboard(false); switchMode("voice"); }} aria-label="Open voice command mode"><Core size={210} reactive active={loading || phase === "thinking"} /></button>
              <div className="dashboard-core-caption">TAP TO ACTIVATE VOICE</div>
              <div className="dashboard-core-sub">Your interface. Your intelligence.</div>
            </article>
            <article className="dashboard-card dashboard-status-card">
              <div className="dashboard-card-top"><span><Activity size={15}/> SYSTEM OVERVIEW</span><span>LIVE</span></div>
              <div className="dashboard-metric"><div className="metric-icon"><BrainCircuit/></div><div><b>AI ENGINE</b><small>Conversation service</small></div><strong className={loading ? "metric-working" : ""}>{loading ? "BUSY" : "READY"}</strong></div>
              <div className="dashboard-metric"><div className="metric-icon"><Activity/></div><div><b>NETWORK</b><small>STYX connectivity</small></div><strong>{net.status.toUpperCase()}</strong></div>
              <div className="dashboard-metric"><div className="metric-icon"><AudioLines/></div><div><b>VOICE SYSTEM</b><small>Microphone & speech</small></div><strong>{convo || recording ? "ACTIVE" : "STANDBY"}</strong></div>
              <div className="dashboard-metric"><div className="metric-icon"><MessageSquare/></div><div><b>CONVERSATIONS</b><small>Saved in this session</small></div><strong>{messages.length}</strong></div>
              <button className="dashboard-text-link" onClick={() => setShowNet(true)}>VIEW NETWORK DETAILS <ArrowUpRight size={14}/></button>
            </article>
            <article className="dashboard-card dashboard-clock-card">
              <div className="dashboard-card-top"><span><Clock3 size={15}/> LOCAL SYSTEM TIME</span><span>AUTO DETECTED</span></div>
              <div className="dashboard-clock-time">{clockTime}</div>
              <div className="dashboard-clock-date">{clockDate}</div>
              <div className="dashboard-clock-zone"><Radio size={13}/>{timezone} <span>{timezoneOffset}</span></div>
            </article>
            <article className="dashboard-card dashboard-command-card">
              <div className="dashboard-card-top"><span>COMMAND INPUT</span><span>TEXT / VOICE</span></div>
              <form className="dashboard-command-form" onSubmit={send}><input value={input} onChange={e=>setInput(e.target.value)} placeholder="What can I do for you?" aria-label="Enter a command"/><button disabled={loading || !input.trim()} aria-label="Send command"><ArrowUpRight size={18}/></button></form>
              <div className="dashboard-quick-label">QUICK COMMANDS</div>
              <div className="dashboard-quick-actions"><button onClick={()=>void sendText("Give me a concise briefing of what you can help me with.")}><BrainCircuit/> Intelligence briefing</button><button onClick={()=>{setShowNet(true)}}><Activity/> Check system connections</button><button onClick={()=>{setDashboard(false);switchMode("text")}}><MessageSquare/> Open conversation</button><button onClick={()=>{setDashboard(false);switchMode("voice")}}><AudioLines/> Start voice session</button></div>
            </article>
            <article className="dashboard-card dashboard-activity-card">
              <div className="dashboard-card-top"><span><Clock3 size={15}/> RECENT ACTIVITY</span><span>{messages.length} ITEMS</span></div>
              {messages.length ? <div className="dashboard-activity-list">{messages.slice(-3).reverse().map((m,i)=><button key={`${i}-${m.role}`} onClick={()=>{setDashboard(false);switchMode("text")}}><span className="activity-dot"/><span><b>{m.role === "user" ? "YOU" : "EDITH"}</b><small>{m.content.replace(/[*_#`]/g,"").slice(0,92)}</small></span><ArrowUpRight size={14}/></button>)}</div> : <div className="dashboard-empty"><div className="activity-orbit"><Clock3/></div><b>No recent activity</b><small>Your interactions will appear here.</small></div>}
            </article>
            <article className="dashboard-card dashboard-tools-card"><div className="dashboard-card-top"><span><Wrench size={15}/> SYSTEM MODULES</span><span>AVAILABLE</span></div><div className="dashboard-module-grid"><button onClick={()=>setShowNet(true)}><Activity/><b>Network</b><small>Connections & status</small></button><button onClick={()=>{setDashboard(false);switchMode("text")}}><BrainCircuit/><b>Intelligence</b><small>Chat with EDITH</small></button><button onClick={()=>setShowSettings(true)}><Settings/><b>Preferences</b><small>Voice & behaviour</small></button></div></article>
            <article className="dashboard-card dashboard-agent-card">
              <div className="dashboard-card-top"><span><Sparkles size={15}/> AGENT MISSION MODE</span><span>{missionRunning ? "AGENT ACTIVE" : missionStatus === "completed" ? "MISSION COMPLETE" : missionStatus === "failed" ? "MISSION FAILED" : "READY"}</span></div>
              <p className="agent-intro">Assign an objective. EDITH plans the work, invokes supported tools, verifies returned results and reports what actually happened. Sensitive actions require approval.</p>
              <form className="agent-mission-form" onSubmit={launchMission}>
                <textarea value={missionInput} onChange={(e)=>setMissionInput(e.target.value)} placeholder="Example: Research the latest AI developments and summarise the three biggest changes." aria-label="Describe an agent mission" rows={3}/>
                <button type="submit" disabled={!missionInput.trim() || missionRunning || loading}>{missionRunning || loading ? <Loader2 className="animate-spin" size={16}/> : <Zap size={16}/>} {missionRunning || loading ? "RUNNING MISSION" : "START MISSION"}</button>
              </form>
              {missionRunning ? <div className="agent-live-progress"><Loader2 size={15} className="animate-spin"/><span><b>EXECUTING OBJECTIVE</b><small>Waiting for verified AI and network tool results.</small></span></div> : latestMission?.steps?.length ? <div className="agent-result-steps">{latestMission.steps.map((step)=><div className="agent-result-step" key={step.id}><span className={step.status === "succeeded" ? "step-status done" : step.status === "failed" ? "step-status failed" : "step-status"} /> <b>{step.tool.replaceAll("_"," ")}</b><small>{step.status}{step.error ? " · "+step.error : ""}</small></div>)}</div> : <div className="agent-empty"><Sparkles size={16}/>Verified execution steps will appear here after a mission.</div>}
            </article>
            <article className="dashboard-card dashboard-mission-card">
              <div className="dashboard-card-top"><span><Zap size={15}/> MISSION TIMELINE</span><span>LIVE SESSION</span></div>
              <div className="mission-steps">
                <div className="mission-step is-complete"><i/><span><b>SESSION</b><small>Private session established</small></span><em>READY</em></div>
                <div className={net.status === "connected" ? "mission-step is-complete" : "mission-step is-current"}><i/><span><b>NETWORK</b><small>{net.status === "connected" ? "Connected services checked" : net.status === "connecting" ? "Checking connected services" : "Connection needs attention"}</small></span><em>{net.status.toUpperCase()}</em></div>
                <div className={loading ? "mission-step is-current" : "mission-step"}><i/><span><b>INTELLIGENCE</b><small>{loading ? "Processing your latest command" : "Awaiting your next command"}</small></span><em>{loading ? "WORKING" : "STANDBY"}</em></div>
                <div className={phase !== "idle" || recording || transcribing ? "mission-step is-current" : "mission-step"}><i/><span><b>VOICE INTERFACE</b><small>{phase === "listening" || recording ? "Listening for input" : phase === "thinking" || transcribing ? "Processing audio" : phase === "speaking" ? "Speaking response" : "Voice interface standing by"}</small></span><em>{phase === "idle" && !recording && !transcribing ? "IDLE" : phase.toUpperCase()}</em></div>
              </div>
            </article>
            <article className="dashboard-card dashboard-memory-card">
              <div className="dashboard-card-top"><span><BrainCircuit size={15}/> CONTEXT SNAPSHOT</span><span>SESSION HISTORY</span></div>
              {messages.length ? <><div className="context-count"><strong>{messages.length}</strong><span>conversation entries<br/>in your session history</span></div><div className="context-latest"><small>LATEST USER COMMAND</small><p>{[...messages].reverse().find(m=>m.role==="user")?.content || "No command recorded yet."}</p></div><button className="dashboard-text-link" onClick={()=>{setDashboard(false);switchMode("text")}}>OPEN CONVERSATION <ArrowUpRight size={14}/></button></> : <div className="provider-empty"><BrainCircuit size={17}/><span>Your conversation context will appear here after your first command.</span></div>}
            </article>
          </div>
            <article className="dashboard-card dashboard-music-card">
              <div className="dashboard-card-top"><span><Music size={15}/> EDITH MUSIC</span><span>{musicTracks.length} TRACKS</span></div>
              <div className="music-player-main">
                <div className="music-art"><Music size={32}/><span className={musicPlaying ? "music-art-pulse" : ""}/></div>
                <div className="music-track-meta"><b>{activeTrack?.title || "Nothing playing"}</b><small>{activeTrack?.artist || "Add a track to begin"}</small></div>
                <button className="music-play-button" onClick={toggleMusic} disabled={!activeTrack} aria-label={musicPlaying ? "Pause music" : "Play music"}>{musicPlaying ? <Pause size={20}/> : <Play size={20}/>}</button>
              </div>
              <input className="music-seek" type="range" min="0" max={musicDuration || 1} value={Math.min(musicProgress,musicDuration || 1)} onChange={e=>{const v=Number(e.target.value);setMusicProgress(v);if(musicAudio.current)musicAudio.current.currentTime=v;}} aria-label="Music position"/>
              <div className="music-time-row"><span>{formatAudioTime(musicProgress)}</span><span>{formatAudioTime(musicDuration)}</span></div>
              <div className="music-controls"><button onClick={()=>changeMusic(musicIndex-1)} disabled={!musicTracks.length} aria-label="Previous track"><SkipBack/></button><button onClick={toggleMusic} disabled={!activeTrack} aria-label={musicPlaying ? "Pause" : "Play"}>{musicPlaying ? <Pause/> : <Play/>}</button><button onClick={()=>changeMusic(musicIndex+1)} disabled={!musicTracks.length} aria-label="Next track"><SkipForward/></button><Volume2 size={16}/><input type="range" min="0" max="1" step=".01" value={musicVolume} onChange={e=>setMusicVolume(Number(e.target.value))} aria-label="Volume"/></div>
              {activeTrack?.youtubeId ? <div className="youtube-player-frame"><div ref={youtubeHost} /></div> : <audio ref={musicAudio} src={activeTrack?.src} onTimeUpdate={e=>setMusicProgress(e.currentTarget.currentTime)} onLoadedMetadata={e=>setMusicDuration(e.currentTarget.duration || 0)} onEnded={()=>changeMusic(musicIndex+1)} onError={()=>{setMusicPlaying(false);setMusicError("Unable to load this audio source.");}}/>}
              <div className="music-add-row"><label className="music-upload"><Upload size={14}/> Add files<input type="file" accept="audio/*" multiple onChange={e=>addMusicFiles(e.target.files)}/></label><form onSubmit={e=>{e.preventDefault();addMusicUrl();}}><input value={musicUrl} onChange={e=>setMusicUrl(e.target.value)} placeholder="Paste YouTube link or audio URL"/><button type="submit" aria-label="Add audio URL"><Plus size={15}/></button></form></div>
              {musicTracks.length>0 && <div className="music-queue">{musicTracks.map((track,index)=><button key={track.id} className={index===musicIndex ? "is-current" : ""} onClick={()=>changeMusic(index)}><span>{index+1}</span><b>{track.title}</b><small>{index===musicIndex && musicPlaying ? "PLAYING" : track.artist}</small></button>)}</div>}
              {musicError && <p className="music-error">{musicError}</p>}
              <p className="music-note">YouTube videos play in the official embedded player. Tracks advance in queue order; some videos may block embedding.</p>
            </article>

          <div className="dashboard-footer"><span>EDITH X1 <i/> PRIVATE SYSTEM</span><span>ALL SYSTEMS ARE MONITORED LOCALLY</span></div>
        </section>
      ) : mode === "voice" ? (
        <section className="voice-stage flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden px-6 pb-28 text-center">
          <button onClick={convo ? stopConvo : startConvo} aria-label={convo ? "End conversation" : "Start talking"} className="rounded-full">
            <Core size={260} reactive active={phase === "thinking"} />
          </button>
          <div className="text-sm tracking-[0.3em] text-primary">
            {phase === "listening" ? "LISTENING..." : phase === "thinking" ? "THINKING..." : phase === "speaking" ? "SPEAKING..." : "TAP THE CORE TO TALK"}
          </div>
          {messages.length > 0 && (
            <p className="line-clamp-3 max-w-md text-sm text-muted-foreground">{messages.at(-1)?.content.replace(/[*_#`]/g, "")}</p>
          )}
          <div className="flex gap-3">
            {phase === "listening" && <button onClick={() => void finishTurn()} className="hud-button">Done speaking</button>}
            {convo && <button onClick={stopConvo} className="hud-mic hud-mic-on" aria-label="End conversation"><Square className="h-4 w-4 fill-current" /></button>}
          </div>
          {voiceError && <p className="text-sm text-destructive">{voiceError}</p>}
          <a href="https://instagram.com/manazz.io" target="_blank" rel="noopener noreferrer" className="text-[10px] tracking-[0.25em] text-muted-foreground transition-colors hover:text-primary">CREATED BY @manazz.io</a>
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
              {m.role === "assistant" && m.network && <TaskPanel network={m.network} />}
              {m.role === "assistant" && <button onClick={() => speak(m.content)} className="mt-1 text-xs tracking-widest text-muted-foreground hover:text-primary">▶ PLAY</button>}
            </div>
          ))}
          {loading && <div className="msg-ai"><span className="typing"><span /><span /><span /></span></div>}
          <div ref={endRef} />
        </div>
      </section>
      <form onSubmit={send} className="glass-panel chat-composer border-t border-border p-4">
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

      {showNet && !showSettings && (
        <aside className="network-popover glass-panel" role="dialog" aria-label="EDITH Network status">
          <div className="network-popover-heading">
            <span className={`network-indicator network-${net.status}`} />
            <span>EDITH NETWORK</span>
            <strong>{net.status.toUpperCase()}</strong>
          </div>
          {net.error && <p className="network-detail">{net.error}</p>}
          {net.tools.length > 0 && <p className="network-detail"><b>Available</b> · {net.tools.map((t) => t.name).join(", ")}</p>}
          {net.misconfigured.map((t) => <p key={t.name} className="network-detail"><b>{t.name}</b> · {t.reason} {t.setup}</p>)}
          {net.unavailable.length > 0 && <p className="network-detail"><b>Unavailable</b> · {net.unavailable.map((t) => t.name).join(", ")}</p>}
          {!net.error && net.tools.length === 0 && net.misconfigured.length === 0 && net.unavailable.length === 0 && <p className="network-detail">Checking connected services…</p>}
        </aside>
      )}
      {!showSettings && <nav className="floating-nav fixed" aria-label="Main navigation"

      >
        <button type="button" onClick={() => setDashboard(true)} className="floating-nav-item" aria-label="Dashboard"><LayoutDashboard className="h-5 w-5" /><span>Home</span></button>
        <button type="button" onClick={() => { setDashboard(false); switchMode("voice"); }} className={!dashboard && mode === "voice" ? "floating-nav-item is-active" : "floating-nav-item"} aria-label="Voice mode">
          <AudioLines className="h-5 w-5" /><span>Voice</span>
        </button>
        <button type="button" onClick={() => { setDashboard(false); switchMode("text"); }} className={!dashboard && mode === "text" ? "floating-nav-item is-active" : "floating-nav-item"} aria-label="Text mode">
          <MessageSquare className="h-5 w-5" /><span>Chat</span>
        </button>
        <button type="button" onClick={() => setShowNet(!showNet)} className={showNet ? "floating-nav-item is-active network-nav-item" : "floating-nav-item network-nav-item"} aria-label="Network status" aria-expanded={showNet}>
          <span className={`network-indicator network-${net.status}`} /><Activity className="h-5 w-5" /><span>Network</span>
        </button>
        <button type="button" onClick={() => { setShowNet(false); setShowSettings(true); }} className="floating-nav-item" aria-label="Settings">
          <Settings className="h-5 w-5" /><span>Settings</span>
        </button>
      </nav>}
    </main>
  );
}
