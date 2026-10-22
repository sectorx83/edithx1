import { SENSITIVE, TONES, VOICES, type StyxSettings } from "@/lib/styx-settings";

type Props = {
  settings: StyxSettings;
  onChange: (s: StyxSettings) => void;
  onClose: () => void;
  onPreview: (voice: string) => void;
};

function Options({ items, value, onPick }: { items: [string, string][]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([id, label]) => (
        <button key={id} onClick={() => onPick(id)} className={value === id ? "hud-chip hud-chip-on" : "hud-chip"}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function SettingsPanel({ settings, onChange, onClose, onPreview }: Props) {
  const set = (patch: Partial<StyxSettings>) => onChange({ ...settings, ...patch });
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <aside className="hud-panel h-full w-full max-w-sm overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="jarvis-title text-lg">SETTINGS</h2>
          <button onClick={onClose} aria-label="Close settings" className="text-muted-foreground hover:text-primary">✕</button>
        </div>

        <section className="mb-8">
          <h3 className="hud-label">Voice</h3>
          <label className="mb-3 flex items-center justify-between text-sm">
            Read replies aloud
            <input type="checkbox" checked={settings.speak_replies} onChange={(e) => set({ speak_replies: e.target.checked })} className="h-5 w-5 accent-primary" />
          </label>
          <select value={settings.voice} onChange={(e) => set({ voice: e.target.value })} className="hud-input w-full">
            {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <button onClick={() => onPreview(settings.voice)} className="mt-2 text-xs tracking-widest text-primary">▶ PREVIEW VOICE</button>
        </section>

        <section className="mb-8">
          <h3 className="hud-label">Tone</h3>
          <Options items={Object.entries(TONES).map(([k, v]) => [k, v.label])} value={settings.tone} onPick={(tone) => set({ tone })} />
        </section>

        <section>
          <h3 className="hud-label">Sensitive topics</h3>
          <Options items={Object.entries(SENSITIVE).map(([k, v]) => [k, v.label])} value={settings.sensitive} onPick={(sensitive) => set({ sensitive })} />
          <p className="mt-3 text-xs text-muted-foreground">{SENSITIVE[settings.sensitive]?.prompt}</p>
        </section>
      </aside>
    </div>
  );
}
