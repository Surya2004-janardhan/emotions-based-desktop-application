import { useState, useEffect, useRef, useCallback } from "react";

import useDaemon from "./hooks/useDaemon";
import useSettings from "./hooks/useSettings";

import RecordingPanel from "./components/RecordingPanel";
import Chatbot from "./components/Chatbot";
import CalendarView from "./components/CalendarView";
import SettingsView from "./components/SettingsView";
// In-app InterventionPopup removed to rely on native Windows notifications
import { logError, logInfo } from "./utils/logger";
import {
  classifyMediaError,
  queryMediaPermissionState,
} from "./utils/mediaPermissions";

import {
  Brain,
  LayoutDashboard,
  CalendarRange,
  SlidersHorizontal,
  MessageCircle,
  Activity,
  ChevronRight,
  BellRing,
} from "lucide-react";

const ipc =
  typeof window !== "undefined" && window.require
    ? window.require("electron").ipcRenderer
    : null;
const BACKEND_BASE_URL = "http://127.0.0.1:5000";

function hasUsableMusicPath(musicPath) {
  return typeof musicPath === "string" && /[\\/]/.test(musicPath);
}

function formatMinutesLabel(value) {
  const totalSeconds = Math.round(Number(value || 0) * 60);
  if (totalSeconds <= 0) return "0 seconds";
  if (totalSeconds < 60) return `${totalSeconds} seconds`;
  if (totalSeconds % 60 === 0) {
    const minutes = totalSeconds / 60;
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export default function App() {
  const { settings, loaded, save } = useSettings();

  const [currentTab, setCurrentTab] = useState("dashboard");
  const [lastDaemonResult, setLastDaemonResult] = useState(null);
  const [musicNowPlaying, setMusicNowPlaying] = useState(null);
  const [pausedForMusic, setPausedForMusic] = useState(false);
  const [permissionReady, setPermissionReady] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [testNotifyBusy, setTestNotifyBusy] = useState(false);
  const [testNotifyStatus, setTestNotifyStatus] = useState("");
  const audioRef = useRef(null);
  const musicQueueRef = useRef([]);
  const musicPlayingRef = useRef(false);
  const memeTimeoutRef = useRef(null);
  const activeInsight = lastDaemonResult;

  const tryPlayNext = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || musicPlayingRef.current) return;
    const nextTrack = musicQueueRef.current.shift();
    if (!nextTrack) return;

    if (!hasUsableMusicPath(nextTrack.musicPath)) {
      logError("app", "support track path is invalid", {
        emotion: nextTrack.emotion,
        musicPath: nextTrack.musicPath,
      });
      setTimeout(() => tryPlayNext(), 150);
      return;
    }

    // Pause background daemon before playback to ensure we don't record the song
    try {
      stopDaemon();
      setPausedForMusic(true);
      logInfo("app", "auto monitoring paused for music playback (tryPlayNext)");
    } catch (err) {
      logError("app", "failed to pause daemon before playback", {
        error: err?.message,
      });
    }

    musicPlayingRef.current = true;
    setMusicNowPlaying(nextTrack);
    const src = `${BACKEND_BASE_URL}/stream_local?path=${encodeURIComponent(nextTrack.musicPath)}`;

    audio.src = src;
    logInfo("app", "support track queued for playback", {
      emotion: nextTrack.emotion,
      musicPath: nextTrack.musicPath,
    });
    logInfo("app", "attempting in-app song playback", {
      emotion: nextTrack.emotion,
      musicPath: nextTrack.musicPath,
      src,
    });
    audio.load();
    audio.play().catch((error) => {
      musicPlayingRef.current = false;
      setMusicNowPlaying(null);
      logError("app", "in-app song playback failed", {
        emotion: nextTrack.emotion,
        musicPath: nextTrack.musicPath,
        error: error?.message,
      });
    });
  }, []);

  const { isDaemonActive, daemonStatus, nextFireIn, startDaemon, stopDaemon } =
    useDaemon({
      settings,
      onNewResult: (result) => setLastDaemonResult(result),
      onShiftDetected: ({ emotion, musicPath, autoPlay }) => {
        logInfo("app", "shift detected", { emotion, musicPath, autoPlay });
        if (!autoPlay) {
          logInfo(
            "app",
            "support playback skipped because auto-play is disabled",
            { emotion, musicPath },
          );
          return;
        }
        if (!musicPath) {
          logError(
            "app",
            "support playback skipped because no music mapping exists",
            { emotion },
          );
          return;
        }
        musicQueueRef.current.push({ emotion, musicPath, at: Date.now() });
        logInfo("app", "support track added to queue", {
          emotion,
          musicPath,
          queueLength: musicQueueRef.current.length,
        });
        tryPlayNext();
      },
    });

  useEffect(() => {
    if (!loaded) return;
    if (settings.autoMode && !isDaemonActive) startDaemon();
    if (!settings.autoMode && isDaemonActive) stopDaemon();
  }, [loaded, settings.autoMode]); // eslint-disable-line

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handlePlaying = () => {
      logInfo("app", "audio element started playback", {
        src: audio.currentSrc,
        paused: audio.paused,
      });

      // When a support song starts, pause/stop background recording to avoid capturing music
      try {
        stopDaemon();
        setPausedForMusic(true);
        logInfo("app", "auto monitoring paused for music playback");
      } catch (err) {
        logError("app", "failed to pause daemon on music start", {
          error: err?.message,
        });
      }

      // Send a native notification via main process (best-effort)
      if (ipc) {
        try {
          ipc.invoke("notify-shift", {
            emotion: musicNowPlaying?.emotion || "music",
            autoPlay: false,
            musicPath: musicNowPlaying?.musicPath || null,
          });
          // Schedule a follow-up meme-rich notification after 5s
          try {
            if (memeTimeoutRef.current) {
              clearTimeout(memeTimeoutRef.current);
              memeTimeoutRef.current = null;
            }
            const meme = lastDaemonResult?.memes?.[0] || null;
            if (meme) {
              memeTimeoutRef.current = setTimeout(() => {
                try {
                  ipc.invoke("notify-shift", {
                    emotion: musicNowPlaying?.emotion || "music",
                    autoPlay: false,
                    musicPath: musicNowPlaying?.musicPath || null,
                    meme,
                    memeOnly: true,
                  });
                } catch (e) {
                  /* ignore */
                }
              }, 20000); // show meme-only notification after 20s
            }
          } catch (e) {
            /* ignore scheduling errors */
          }
        } catch (err) {
          // ignore
        }
      }
    };

    const handleStop = () => {
      musicPlayingRef.current = false;
      setMusicNowPlaying(null);
      logInfo("app", "song playback finished or reset");
      if (memeTimeoutRef.current) {
        clearTimeout(memeTimeoutRef.current);
        memeTimeoutRef.current = null;
      }
      setTimeout(() => tryPlayNext(), 150);
      // Resume auto monitoring after the song ends if auto mode is enabled
      try {
        setPausedForMusic(false);
        if (settings.autoMode) {
          startDaemon();
          logInfo("app", "auto monitoring resumed after music playback");
        }
      } catch (err) {
        logError("app", "failed to resume daemon after music", {
          error: err?.message,
        });
      }
    };
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("ended", handleStop);
    audio.addEventListener("error", handleStop);

    return () => {
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("ended", handleStop);
      audio.removeEventListener("error", handleStop);
    };
  }, [tryPlayNext]);

  // Listen for notification action responses from main process
  useEffect(() => {
    if (!ipc) return undefined;
    const handler = (_e, { action, emotion, musicPath }) => {
      try {
        if (action === "play" && musicPath) {
          // Pause background daemon immediately and mark pausedForMusic
          try {
            stopDaemon();
            setPausedForMusic(true);
            logInfo("app", "daemon paused in response to notification Play");
          } catch (err) {
            logError("app", "failed to pause daemon on notification Play", {
              error: err?.message,
            });
          }

          // Clear any scheduled meme notification
          try {
            if (memeTimeoutRef.current) {
              clearTimeout(memeTimeoutRef.current);
              memeTimeoutRef.current = null;
            }
          } catch (e) {
            /* ignore */
          }

          // Ensure playback can start: clear stale flag, queue track, and attempt immediate play
          musicPlayingRef.current = false;
          musicQueueRef.current.push({ emotion, musicPath, at: Date.now() });
          logInfo("app", "user approved playback from notification", {
            emotion,
            musicPath,
          });

          tryPlayNext();
          try {
            const a = audioRef.current;
            if (a && a.paused && a.src) {
              a.play().catch(() => {});
            }
          } catch (e) {
            /* ignore */
          }
        } else {
          logInfo("app", "user declined playback from notification", {
            emotion,
          });
        }
      } catch (err) {
        logError("app", "notification-action handler error", {
          error: err?.message,
        });
      }
    };
    ipc.on("notification-action", handler);
    return () => ipc.removeListener("notification-action", handler);
  }, [tryPlayNext]);

  useEffect(() => {
    let active = true;
    const refreshPermissionState = async () => {
      const state = await queryMediaPermissionState();
      if (!active) return;
      const ready =
        state.camera === "granted" && state.microphone === "granted";
      setPermissionReady(ready);
      if (ready) {
        setPermissionError(null);
      }
    };
    refreshPermissionState();
    const intervalId = setInterval(refreshPermissionState, 3000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  const requestDashboardPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionReady(true);
      setPermissionError(null);
      logInfo("app", "dashboard camera+mic permission granted");
    } catch (error) {
      const kind = classifyMediaError(error);
      const message =
        kind === "permission_denied"
          ? "Please enable both camera and microphone access for EmotionAI."
          : kind === "device_busy"
            ? "Camera or microphone is currently being used by another app."
            : kind === "device_missing"
              ? "Camera or microphone was not found on this system."
              : error?.message ||
                "Camera and microphone access could not be started.";
      setPermissionReady(false);
      setPermissionError(message);
      logError("app", "dashboard permission request failed", {
        error: error?.message,
        kind,
      });
    }
  }, []);

  const fmtCountdown = (secs) => {
    if (!secs) return "";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const handleTestSystemNotification = useCallback(async () => {
    if (!ipc || testNotifyBusy) return;
    setTestNotifyBusy(true);
    setTestNotifyStatus("");
    logInfo("app", "manual system notification test requested");
    try {
      const result = await ipc.invoke("notify-shift", {
        emotion: "test",
        autoPlay: false,
        musicPath: null,
      });
      if (result?.ok) {
        setTestNotifyStatus("Windows notification sent.");
        logInfo("app", "manual system notification test succeeded");
      } else {
        setTestNotifyStatus(result?.error || "Notification test failed.");
        logError("app", "manual system notification test failed", {
          error: result?.error || "Unknown error",
        });
      }
    } catch (error) {
      setTestNotifyStatus(error?.message || "Notification test failed.");
      logError("app", "manual system notification test errored", {
        error: error?.message,
      });
    } finally {
      setTestNotifyBusy(false);
    }
  }, [testNotifyBusy]);

  const daemonLabel =
    daemonStatus === "recording"
      ? "Recording..."
      : daemonStatus === "processing"
        ? "Analyzing..."
        : daemonStatus === "permission_required"
          ? "Permission Required"
          : daemonStatus === "paused_device_busy"
            ? "Paused: Device Busy"
            : "Monitoring";

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: "calendar",
      label: "History",
      icon: <CalendarRange className="w-4 h-4" />,
    },
    {
      id: "assistant",
      label: "AI Assistant",
      icon: <MessageCircle className="w-4 h-4" />,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <SlidersHorizontal className="w-4 h-4" />,
    },
    { id: "testing", label: "Testing", icon: <BellRing className="w-4 h-4" /> },
  ];

  const stopMusicNow = useCallback(() => {
    try {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch (e) {
          /* ignore */
        }
        audio.src = "";
      }
      musicQueueRef.current = [];
      musicPlayingRef.current = false;
      setMusicNowPlaying(null);
      logInfo("app", "support playback stopped by user");
      setPausedForMusic(false);
      if (settings.autoMode) {
        startDaemon();
        logInfo("app", "auto monitoring resumed after manual stop");
      }
    } catch (err) {
      logError("app", "failed to stop music", { error: err?.message });
    }
  }, [settings.autoMode]);

  if (!loaded)
    return (
      <div className="flex items-center justify-center h-screen bg-bg-base">
        <div className="flex flex-col items-center gap-4 text-text-muted">
          <Brain className="w-10 h-10 text-primary animate-pulse" />
          <span className="text-sm font-medium">Loading EmotionAI...</span>
        </div>
      </div>
    );

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base text-text-primary">
      {/* In-app popup disabled; using native Windows notifications instead */}

      <aside className="w-56 shrink-0 flex flex-col border-r border-border-subtle bg-surface-base">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border-subtle">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Brain className="w-5 h-5 text-primary" strokeWidth={2.5} />
          </div>
          <span className="text-base font-black text-text-primary tracking-tight">
            Emotion<span className="text-primary">AI</span>
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setCurrentTab(id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer group ${
                currentTab === id
                  ? "bg-primary/10 text-primary"
                  : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
              }`}
            >
              <div className="flex items-center gap-3">
                {icon}
                {label}
              </div>
              {currentTab === id && (
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              )}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-border-subtle">
          <div className="px-3 py-3 rounded-xl bg-surface-raised border border-border-subtle">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Auto Mode
              </span>
              <button
                onClick={() => save({ autoMode: !settings.autoMode })}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  settings.autoMode ? "bg-primary" : "bg-border-strong"
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    settings.autoMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {isDaemonActive ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                    {daemonLabel}
                  </span>
                </div>
                {nextFireIn && daemonStatus === "waiting" && (
                  <p className="text-[10px] text-text-muted">
                    Next: {fmtCountdown(nextFireIn)}
                  </p>
                )}
                {daemonStatus === "permission_required" && (
                  <p className="text-[10px] text-amber-600 leading-relaxed">
                    Enable both camera and microphone once to let auto mode
                    start.
                  </p>
                )}
                {daemonStatus === "paused_device_busy" && (
                  <p className="text-[10px] text-amber-600 leading-relaxed">
                    Camera or microphone is busy in another app. Auto mode will
                    try again after they are free.
                  </p>
                )}
                {musicNowPlaying && (
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-primary font-semibold">
                      Playing support track for {musicNowPlaying.emotion}
                    </p>
                    <button
                      onClick={stopMusicNow}
                      className="text-[10px] px-2 py-1 rounded-md bg-red-50 text-red-600 border border-red-200 hover:opacity-90"
                    >
                      Stop Music
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-text-muted leading-relaxed">
                Runs every {formatMinutesLabel(settings.intervalMinutes)},
                records {formatMinutesLabel(settings.recordDurationMinutes)}
              </p>
            )}
          </div>
        </div>

        <div className="px-5 py-3 text-[9px] text-text-muted border-t border-border-subtle">
          D7 · Final Year Project
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {currentTab === "dashboard" && (
            <div className="space-y-8 animate-fade-up">
              <div>
                <h1 className="text-2xl font-black text-text-primary">
                  Dashboard
                </h1>
                <p className="text-sm text-text-muted mt-1">
                  Track emotion-driven stress patterns for workplace well-being
                  over time.
                </p>
              </div>

              <RecordingPanel
                autoMode={settings.autoMode}
                daemonStatus={daemonStatus}
                nextFireLabel={
                  nextFireIn && daemonStatus === "waiting"
                    ? fmtCountdown(nextFireIn)
                    : ""
                }
                permissionReady={permissionReady}
                permissionError={permissionError}
                requestPermission={requestDashboardPermission}
                intervalLabel={formatMinutesLabel(settings.intervalMinutes)}
                recordDurationLabel={formatMinutesLabel(
                  settings.recordDurationMinutes,
                )}
                settings={settings}
                save={save}
                pausedForMusic={pausedForMusic}
              />

              {musicNowPlaying && (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-primary font-semibold">
                    Now playing: {musicNowPlaying.emotion}
                  </p>
                  <button
                    onClick={stopMusicNow}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:opacity-90"
                  >
                    Stop Music
                  </button>
                </div>
              )}

              {lastDaemonResult && (
                <div className="panel p-5 border border-border-subtle animate-fade-up">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-primary animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">
                      Latest Background Reading
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="px-4 py-2 rounded-xl bg-surface-raised border border-border-subtle">
                      <p className="text-xs text-text-muted">Emotion</p>
                      <p
                        className="text-lg font-black capitalize"
                        style={{
                          color: `var(--color-em-${lastDaemonResult.fused_emotion})`,
                        }}
                      >
                        {lastDaemonResult.fused_emotion}
                      </p>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {lastDaemonResult.reasoning}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentTab === "calendar" && <CalendarView />}

          {currentTab === "settings" && (
            <SettingsView settings={settings} onSave={save} />
          )}

          {currentTab === "testing" && (
            <div className="space-y-8 animate-fade-up pb-12">
              <div>
                <h1 className="text-2xl font-black text-text-primary">
                  Testing
                </h1>
                <p className="text-sm text-text-muted mt-1">
                  Use this page to verify native Windows notifications without
                  waiting for the monitoring cycle.
                </p>
              </div>

              <section className="panel p-6 space-y-5 max-w-2xl">
                <div className="flex items-center gap-3 pb-3 border-b border-border-subtle">
                  <BellRing className="w-5 h-5 text-primary" />
                  <div>
                    <h2 className="text-base font-bold text-text-primary">
                      System Notification Test
                    </h2>
                    <p className="text-xs text-text-muted">
                      This triggers the Electron native notification handler
                      directly.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleTestSystemNotification}
                  disabled={testNotifyBusy}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white text-sm font-bold cursor-pointer hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {testNotifyBusy ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <BellRing className="w-4 h-4" />
                  )}
                  Send Windows Notification
                </button>

                <p className="text-sm text-text-secondary leading-relaxed">
                  Expected result: a native Windows toast should appear even if
                  the app window is not focused.
                </p>

                {testNotifyStatus && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-text-primary">
                    {testNotifyStatus}
                  </div>
                )}
              </section>
            </div>
          )}

          {currentTab === "assistant" && (
            <div className="h-[calc(100vh-8rem)] min-h-[560px] panel overflow-hidden">
              <Chatbot results={activeInsight} isOpen mode="page" />
            </div>
          )}
        </div>
      </main>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
