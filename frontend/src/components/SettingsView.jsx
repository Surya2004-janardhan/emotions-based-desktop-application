import { useRef, useState } from "react";
import { Music, Upload, CheckCircle2, SlidersHorizontal } from "lucide-react";
import { getBackendUrl } from "../hooks/useBackendUrl";

const EMOTIONS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "fearful",
  "disgust",
  "surprised",
];
const ipc =
  typeof window !== "undefined" && window.require
    ? window.require("electron").ipcRenderer
    : null;

export default function SettingsView({ settings, onSave }) {
  const [saveStatus, setSaveStatus] = useState({});
  const [savedFlag, setSavedFlag] = useState(false);
  const fileInputRefs = useRef({});

  const set = async (patch) => {
    await onSave(patch);
  };

  const persistMusicFile = async (emotion, filePath) => {
    setSaveStatus((s) => ({ ...s, [emotion]: "saving" }));
    try {
      const prev = settings.musicMappings || {};
      await onSave({ musicMappings: { ...prev, [emotion]: filePath } });
      setSaveStatus((s) => ({ ...s, [emotion]: "saved" }));
      setTimeout(() => setSaveStatus((s) => ({ ...s, [emotion]: null })), 2500);

      // Also sync to backend (HF Space in prod, localhost in dev)
      try {
        const { default: axios } = await import("axios");
        const backendUrl = await getBackendUrl();
        await axios.post(`${backendUrl}/mappings`, {
          emotion,
          music_path: filePath,
        });
      } catch (error) {
        console.warn("Failed to sync music mapping to backend:", error);
      }
    } catch {
      setSaveStatus((s) => ({ ...s, [emotion]: "error" }));
    }
  };

  const handleMusicFile = async (emotion, e) => {
    const file = e.target.files?.[0];
    const filePath = file?.path;
    if (!filePath) {
      setSaveStatus((s) => ({ ...s, [emotion]: "error" }));
      return;
    }
    await persistMusicFile(emotion, filePath);
    e.target.value = "";
  };

  const handleChooseMusic = async (emotion) => {
    if (!ipc) {
      fileInputRefs.current[emotion]?.click();
      return;
    }

    const picked = await ipc.invoke("pick-music-file");
    if (!picked || picked.canceled || !picked.filePath) return;
    await persistMusicFile(emotion, picked.filePath);
  };

  return (
    <div className="space-y-8 animate-fade-up pb-12">
      <div>
        <h1 className="text-2xl font-black text-text-primary">Settings</h1>
        <p className="text-sm text-text-muted mt-1">
          All settings save automatically and persist across sessions.
        </p>
      </div>

      {/* Monitoring Settings */}
      <section className="panel p-6 space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-border-subtle">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-text-primary">Monitoring</h2>
        </div>

        {/* Interval */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Check interval
            </p>
            <p className="text-xs text-text-muted">
              How often the background check runs
            </p>
          </div>
          <select
            value={settings.intervalMinutes}
            onChange={(e) => set({ intervalMinutes: Number(e.target.value) })}
            className="px-3 py-2 rounded-lg bg-surface-raised border border-border-strong text-sm font-bold text-text-primary outline-none cursor-pointer"
          >
            <option value={1 / 3}>Every 20 seconds</option>
            <option value={2}>Every 2 minutes</option>
            <option value={10}>Every 10 minutes</option>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={45}>Every 45 minutes</option>
            <option value={60}>Every 60 minutes</option>
            <option value={90}>Every 90 minutes</option>
            <option value={120}>Every 120 minutes</option>
          </select>
        </div>

        {/* Recording Duration */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Recording duration
            </p>
            <p className="text-xs text-text-muted">
              How long each background session captures
            </p>
          </div>
          <select
            value={settings.recordDurationMinutes}
            onChange={(e) =>
              set({ recordDurationMinutes: Number(e.target.value) })
            }
            className="px-3 py-2 rounded-lg bg-surface-raised border border-border-strong text-sm font-bold text-text-primary outline-none cursor-pointer"
          >
            <option value={1 / 6}>10 seconds</option>
            <option value={1}>1 minute</option>
            <option value={2}>2 minutes </option>
            <option value={5}>5 minutes</option>
            <option value={6}>6 minutes</option>
            <option value={7}>7 minutes</option>
            <option value={10}>10 minutes</option>
          </select>
        </div>

        {/* Notification Style */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              When an emotional shift is estimated
            </p>
            <p className="text-xs text-text-muted">
              Controls how the stress-support popup and music behave
            </p>
          </div>
          <select
            value={settings.notifyPermission}
            onChange={(e) => set({ notifyPermission: e.target.value })}
            className="px-3 py-2 rounded-lg bg-surface-raised border border-border-strong text-sm font-bold text-text-primary outline-none cursor-pointer"
          >
            <option value="ask">Ask me first</option>
            <option value="auto">Play automatically</option>
          </select>
        </div>
      </section>

      {/* API Key */}
      <section className="panel p-6 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border-subtle">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-base font-bold text-text-primary">
              AI Service
            </h2>
            <p className="text-xs text-text-muted">
              Provide your Groq API key to enable personalized AI content
              generation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <input
            type="password"
            placeholder="Enter your Groq API key"
            value={settings.groqApiKey || ""}
            onChange={(e) => set({ groqApiKey: e.target.value })}
            className="flex-1 px-3 py-2 rounded-lg bg-surface-base border border-border-strong text-sm text-text-primary outline-none"
          />
          <button
            onClick={async () => {
              await onSave({ groqApiKey: settings.groqApiKey || "" });
              setSavedFlag(true);
              setTimeout(() => setSavedFlag(false), 1800);
            }}
            className={`px-4 py-2 rounded-lg text-white text-sm font-bold ${savedFlag ? "bg-primary/60 opacity-70" : "bg-primary hover:opacity-90"}`}
          >
            {savedFlag ? "Saved" : "Save"}
          </button>
          <button
            onClick={async () => {
              await onSave({ groqApiKey: "" });
            }}
            className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-semibold border border-red-100 hover:opacity-90"
          >
            Clear
          </button>
        </div>
      </section>

      {/* Music Mappings */}
      <section className="panel p-6 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border-subtle">
          <Music className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-base font-bold text-text-primary">
              Intervention Music
            </h2>
            <p className="text-xs text-text-muted">
              Map a local audio file to each emotion state
            </p>
          </div>
        </div>

        {EMOTIONS.map((emotion) => {
          const mapped = settings.musicMappings?.[emotion];
          const status = saveStatus[emotion];
          return (
            <div
              key={emotion}
              className="flex items-center justify-between gap-4 p-3 rounded-xl bg-surface-raised border border-border-subtle"
            >
              <div className="flex items-center gap-3 min-w-[130px]">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: `var(--color-em-${emotion})` }}
                />
                <span className="text-sm font-semibold text-text-primary capitalize">
                  {emotion}
                </span>
              </div>

              <div
                className="flex-1 px-3 py-1.5 bg-surface-base border border-border-strong rounded-lg text-xs font-mono text-text-secondary truncate"
                title={mapped}
              >
                {mapped ? (
                  mapped.split(/[/\\]/).pop()
                ) : (
                  <span className="text-text-muted italic">Not mapped</span>
                )}
              </div>

              <div className="relative shrink-0">
                {!ipc && (
                  <input
                    ref={(node) => {
                      fileInputRefs.current[emotion] = node;
                    }}
                    type="file"
                    accept="audio/*"
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    onChange={(e) => handleMusicFile(emotion, e)}
                  />
                )}
                <button
                  onClick={() => handleChooseMusic(emotion)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold transition-colors cursor-pointer hover:opacity-90"
                >
                  {status === "saving" ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : status === "saved" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-300" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {mapped ? "Change" : "Choose"}
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
