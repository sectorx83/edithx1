import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AudioLines, Check, Mic2, ShieldCheck, SlidersHorizontal, Volume2, X } from "lucide-react";
import { SENSITIVE, TONES, type StyxSettings } from "@/lib/styx-settings";
import { localVoices } from "@/lib/local-voice";

type Props = {
  settings: StyxSettings;
  onChange: (s: StyxSettings) => void;
  onClose: () => void;
  onPreview: (voice: string) => void;
};

function Options({ items, value, onPick }: { items: [string, string][]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="settings-options">
      {items.map(([id, label]) => (
        <button
          type="button"
          key={id}
          onClick={() => onPick(id)}
          aria-pressed={value === id}
          className={value === id ? "settings-option is-selected" : "settings-option"}
        >
          <span>{label}</span>
          {value === id && <Check className="h-4 w-4" />}
        </button>
      ))}
    </div>
  );
}

export function SettingsPanel({ settings, onChange, onClose, onPreview }: Props) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const update = () => setVoices(localVoices());
    update();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.speechSynthesis?.addEventListener("voiceschanged", update);
    window.addEventListener("keydown", onKey);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", update);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const set = (patch: Partial<StyxSettings>) => onChange({ ...settings, ...patch });
  const selectedVoice = voices.some((voice) => voice.voiceURI === settings.voice) ? settings.voice : "device-default";

  return createPortal((
    <div
      className="settings-backdrop"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="settings-window" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div className="flex min-w-0 items-center gap-3">
            <div className="settings-brand-core"><span /></div>
            <div className="min-w-0">
              <p className="settings-eyebrow">E.D.I.T.H. X1 / CONTROL CENTER</p>
              <h2 id="settings-title" className="settings-title">Settings</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close settings" className="settings-close" title="Close settings"><X className="h-5 w-5" /></button>
        </header>

        <div className="settings-scroll">
          <div className="settings-intro">
            <div>
              <p className="settings-eyebrow">SYSTEM PREFERENCES</p>
              <h3>Make EDITH work your way.</h3>
              <p>Voice output, response style and safety behaviour. Changes save automatically.</p>
            </div>
            <div className="settings-status"><span /> LOCAL PROFILE</div>
          </div>

          <div className="settings-grid">
            <section className="settings-card">
              <div className="settings-card-heading">
                <div className="settings-icon"><Volume2 className="h-5 w-5" /></div>
                <div><h3>Voice output</h3><p>How EDITH speaks to you</p></div>
              </div>
              <label className="settings-toggle-row">
                <span><b>Speak replies automatically</b><small>Read each assistant response aloud</small></span>
                <input type="checkbox" checked={settings.speak_replies} onChange={(event) => set({ speak_replies: event.target.checked })} />
              </label>
              <label className="settings-field-label" htmlFor="edith-voice">DEVICE VOICE</label>
              <select id="edith-voice" value={selectedVoice} onChange={(event) => set({ voice: event.target.value })} className="settings-select">
                <option value="device-default">Device default</option>
                {voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>)}
              </select>
              <button type="button" onClick={() => onPreview(settings.voice)} className="settings-preview"><AudioLines className="h-4 w-4" /> Preview voice</button>
              <p className="settings-footnote">{voices.length ? `${voices.length} device voices available` : "Voice list is supplied by your device."}</p>
            </section>

            <section className="settings-card">
              <div className="settings-card-heading">
                <div className="settings-icon"><SlidersHorizontal className="h-5 w-5" /></div>
                <div><h3>Response personality</h3><p>Choose how replies are written</p></div>
              </div>
              <Options items={Object.entries(TONES).map(([key, item]) => [key, item.label])} value={settings.tone} onPick={(tone) => set({ tone })} />
              <p className="settings-description">{TONES[settings.tone]?.prompt}</p>
            </section>

            <section className="settings-card settings-card-wide">
              <div className="settings-card-heading">
                <div className="settings-icon"><ShieldCheck className="h-5 w-5" /></div>
                <div><h3>Sensitive topics</h3><p>Set the response approach for high-stakes subjects</p></div>
              </div>
              <Options items={Object.entries(SENSITIVE).map(([key, item]) => [key, item.label])} value={settings.sensitive} onPick={(sensitive) => set({ sensitive })} />
              <p className="settings-description">{SENSITIVE[settings.sensitive]?.prompt}</p>
            </section>

            <section className="settings-card settings-card-wide">
              <div className="settings-card-heading">
                <div className="settings-icon"><SlidersHorizontal className="h-5 w-5" /></div>
                <div><h3>Google integrations</h3><p>Connect Google services to EDITH X1</p></div>
              </div>
              <div className="settings-info-row"><span>Gmail</span><b>OAuth setup required</b></div>
              <div className="settings-info-row"><span>Google Calendar</span><b>OAuth setup required</b></div>
              <div className="settings-info-row"><span>Google Drive</span><b>OAuth setup required</b></div>
              <p className="settings-description">Secure account linking is not active yet. Google requires an OAuth application owned by you or your organization. EDITH will request access only after that application is configured; no Google account is connected right now.</p>
              <a className="settings-preview" href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noreferrer">Open Google OAuth setup</a>
              <p className="settings-footnote">After creating a Web application OAuth client, add its Client ID and Client Secret to Vercel as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Never paste the secret into this chat.</p>
            </section>

            <section className="settings-card settings-card-wide settings-system-card">
              <div className="settings-card-heading">
                <div className="settings-icon"><Mic2 className="h-5 w-5" /></div>
                <div><h3>Interaction</h3><p>Voice and chat are available from the floating navigation dock</p></div>
              </div>
              <div className="settings-info-row"><span>Voice input</span><b>Device microphone</b></div>
              <div className="settings-info-row"><span>Speech engine</span><b>Local device voices</b></div>
              <div className="settings-info-row"><span>Preference sync</span><b>Automatic</b></div>
            </section>
          </div>
        </div>
        <footer className="settings-footer"><span>EDITH X1 · PRIVATE CONTROL CENTER</span><button type="button" onClick={onClose}>Done</button></footer>
      </section>
    </div>
  ), document.body);
}
