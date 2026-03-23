/**
 * useDaemon — Background Monitoring Service
 *
 * Behavior per plan.md requirements #3, #4, #5, #6:
 * - When Auto Mode is ON, loop is: wait `intervalMinutes` -> record `recordDurationMinutes`.
 * - As soon as recording ends, the next wait interval begins immediately.
 * - The recorded clip is processed in the background without blocking the next timer cycle.
 * - After recording: send to Flask /process in background, persist result via IPC.
 * - After processing: detect emotional shift vs. recent history.
 * - If shift detected: fire native OS notification via IPC.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import { logError, logInfo } from "../utils/logger";
import {
  classifyMediaError,
  queryMediaPermissionState,
} from "../utils/mediaPermissions";

const ipc =
  typeof window !== "undefined" && window.require
    ? window.require("electron").ipcRenderer
    : null;

const NEGATIVE_EMOTIONS = ["angry", "sad", "fearful", "disgust"];
const MEDIA_CONSTRAINTS = {
  video: {
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 15, max: 24 },
  },
  audio: true,
};

export default function useDaemon({ settings, onNewResult, onShiftDetected }) {
  const [isDaemonActive, setIsDaemonActive] = useState(false);
  const [daemonStatus, setDaemonStatus] = useState("idle");
  const [nextFireIn, setNextFireIn] = useState(null);
  const [liveStream, setLiveStream] = useState(null);
  const permissionGateRef = useRef("unknown");

  const timeoutRef = useRef(null);
  const countdownRef = useRef(null);
  const recordingRef = useRef(null);
  const processingTasksRef = useRef(new Set());
  const recentEmotions = useRef([]);
  const activeRef = useRef(false);
  const loopRef = useRef(null);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const clearPendingWait = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearInterval(countdownRef.current);
    timeoutRef.current = null;
    countdownRef.current = null;
    setNextFireIn(null);
  }, []);

  const evaluateMediaAccess = useCallback(async () => {
    const state = await queryMediaPermissionState();
    const bothGranted =
      state.camera === "granted" && state.microphone === "granted";
    permissionGateRef.current = bothGranted
      ? "granted"
      : state.camera === "denied" || state.microphone === "denied"
        ? "denied"
        : "unknown";
    return { state, bothGranted };
  }, []);

  useEffect(() => {
    let active = true;
    let intervalId = null;
    const refreshPermissions = async () => {
      const { state } = await evaluateMediaAccess();
      if (!active) return;
      if (!activeRef.current) return;
      const bothGranted =
        state.camera === "granted" && state.microphone === "granted";
      if (!bothGranted) {
        clearPendingWait();
        setDaemonStatus("permission_required");
      } else if (activeRef.current) {
        setDaemonStatus((current) => {
          if (["recording", "paused_device_busy"].includes(current))
            return current;
          if (current === "permission_required") {
            setTimeout(() => {
              if (activeRef.current) {
                loopRef.current?.();
              }
            }, 0);
          }
          return "waiting";
        });
      }
    };
    refreshPermissions();
    intervalId = setInterval(refreshPermissions, 3000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [evaluateMediaAccess, clearPendingWait]);

  const requestStream = async () => {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
      setLiveStream(stream);
      permissionGateRef.current = "granted";
      logInfo("daemon", "stream acquired with audio");
      return stream;
    } catch (error) {
      const kind = classifyMediaError(error);
      throw Object.assign(
        error instanceof Error
          ? error
          : new Error(error?.message || "Media request failed"),
        { mediaKind: kind },
      );
    }
  };

  const releaseStream = (stream) => {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    setLiveStream((current) => (current === stream ? null : current));
  };

  const recordForDuration = useCallback((stream, durationMs) => {
    const mimeType =
      stream.getAudioTracks().length > 0
        ? "video/webm;codecs=vp8,opus"
        : "video/webm;codecs=vp8";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];

    return new Promise((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onerror = reject;
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: "video/webm" }));
      };

      recordingRef.current = recorder;
      recorder.start(200);
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, durationMs);
    });
  }, []);

  const analyzeBlob = useCallback(async (blob) => {
    logInfo("daemon", "background analysis request start", {
      size: blob?.size,
    });
    const formData = new FormData();
    formData.append("video", blob, "daemon_capture.webm");
    const res = await axios.post("/process", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    logInfo("daemon", "background analysis request end", {
      jobId: res.data?.job_id,
      emotion: res.data?.fused_emotion,
      error: res.data?.error,
    });
    return res.data;
  }, []);

  const detectShift = useCallback((emotion) => {
    if (!emotion) return false;
    if (recentEmotions.current.length === 0)
      return NEGATIVE_EMOTIONS.includes(emotion);

    const prev = recentEmotions.current[recentEmotions.current.length - 1];
    const changed = prev !== emotion;
    const becameNegative =
      NEGATIVE_EMOTIONS.includes(emotion) && !NEGATIVE_EMOTIONS.includes(prev);
    return changed && becameNegative;
  }, []);

  const triggerNotification = useCallback(
    async (emotion, meme = null) => {
      const currentSettings = settingsRef.current || {};
      const autoPlay = currentSettings.notifyPermission === "auto";
      const musicPath = currentSettings.musicMappings?.[emotion];

      logInfo("daemon", "trigger notification", {
        emotion,
        autoPlay,
        musicPath,
        hasMeme: !!meme,
      });

      if (onShiftDetected) {
        onShiftDetected({ emotion, musicPath, autoPlay });
      }

      if (ipc) {
        try {
          await ipc.invoke("notify-shift", {
            emotion,
            autoPlay,
            musicPath,
            meme,
          });
          logInfo("daemon", "notification ipc sent");
        } catch (e) {
          logError("daemon", "notification ipc failed", { error: e.message });
        }
      } else if ("Notification" in window) {
        try {
          if (Notification.permission === "granted") {
            new Notification("EmotionAI - Emotional Shift", {
              body: `Detected shift to ${emotion}.`,
            });
          }
        } catch (e) {
          console.error("[Daemon] Web notification fallback failed:", e);
        }
      }
    },
    [onShiftDetected],
  );

  const processRecordingInBackground = useCallback(
    async ({ blob, startedAt, endedAt }) => {
      const task = (async () => {
        try {
          const result = await analyzeBlob(blob);

          if (!result || result.error) {
            logError("daemon", "background processing failed", {
              error: result?.error || "Unknown error",
            });
            return;
          }

          const emotion = result.fused_emotion;
          logInfo("daemon", "background analysis done", {
            emotion,
            jobId: result.job_id,
          });
          const enrichedResult = {
            ...result,
            recording_started_at: startedAt,
            recording_ended_at: endedAt,
          };

          const shouldNotify = detectShift(emotion);
          const previousEmotion =
            recentEmotions.current[recentEmotions.current.length - 1] || null;
          logInfo("daemon", "notification decision evaluated", {
            emotion,
            previousEmotion,
            shouldNotify,
            notifyPermission: settingsRef.current?.notifyPermission,
            musicPath: settingsRef.current?.musicMappings?.[emotion] || null,
          });

          recentEmotions.current.push(emotion);
          if (recentEmotions.current.length > 5) recentEmotions.current.shift();

          if (ipc) await ipc.invoke("save-result", enrichedResult);

          if (onNewResult) onNewResult(enrichedResult);

          if (shouldNotify) {
            // Fire the initial notification (ask/play) without embedding the meme
            await triggerNotification(emotion);
          } else {
            logInfo("daemon", "notification skipped", {
              emotion,
              previousEmotion,
              reason:
                "shift detector did not mark this reading as a notify event",
            });
          }
        } catch (err) {
          logError("daemon", "background processing error", {
            error: err.message,
          });
        }
      })();

      processingTasksRef.current.add(task);
      try {
        await task;
      } finally {
        processingTasksRef.current.delete(task);
      }
    },
    [analyzeBlob, detectShift, onNewResult, triggerNotification],
  );

  const runSession = useCallback(async () => {
    const durationMin = settingsRef.current.recordDurationMinutes || 5;
    const durationMs = durationMin * 60 * 1000;
    logInfo("daemon", "session start", { durationMin });
    let stream = null;
    let startedAt = null;
    let endedAt = null;
    let keepPausedStatus = false;

    try {
      const { state: permissionState, bothGranted } =
        await evaluateMediaAccess();

      if (!bothGranted) {
        clearPendingWait();
        setDaemonStatus("permission_required");
        keepPausedStatus = true;
        logInfo(
          "daemon",
          "session paused waiting for camera+microphone permission",
          permissionState,
        );
        return "paused_permission";
      }

      startedAt = new Date().toISOString();
      stream = await requestStream();
      setDaemonStatus("recording");
      logInfo("daemon", "recording started", { startedAt });

      const blob = await recordForDuration(stream, durationMs);
      endedAt = new Date().toISOString();
      logInfo("daemon", "recording ended", {
        startedAt,
        endedAt,
        size: blob?.size,
      });
      releaseStream(stream);
      stream = null;
      setDaemonStatus("waiting");

      void processRecordingInBackground({
        blob,
        startedAt,
        endedAt,
      });
      return "completed";
    } catch (err) {
      if (err?.mediaKind === "device_busy") {
        clearPendingWait();
        setDaemonStatus("paused_device_busy");
        keepPausedStatus = true;
        logInfo(
          "daemon",
          "session paused because camera or microphone is busy",
          { error: err.message },
        );
        return "paused_device_busy";
      } else if (err?.mediaKind === "permission_denied") {
        clearPendingWait();
        setDaemonStatus("permission_required");
        permissionGateRef.current = "denied";
        keepPausedStatus = true;
        logInfo("daemon", "session paused because permission was denied", {
          error: err.message,
        });
        return "paused_permission";
      } else {
        logError("daemon", "session error", { error: err.message });
        return "error";
      }
    } finally {
      releaseStream(stream);
      if (activeRef.current && !keepPausedStatus) {
        setDaemonStatus("waiting");
      }
    }
  }, [
    recordForDuration,
    processRecordingInBackground,
    evaluateMediaAccess,
    clearPendingWait,
  ]);

  const beginCountdown = useCallback((intervalMs) => {
    clearInterval(countdownRef.current);
    let secsLeft = Math.ceil(intervalMs / 1000);
    setNextFireIn(secsLeft);
    countdownRef.current = setInterval(() => {
      secsLeft -= 1;
      setNextFireIn(Math.max(0, secsLeft));
    }, 1000);
  }, []);

  loopRef.current = async () => {
    if (!activeRef.current) return;
    const intervalMs = (settingsRef.current.intervalMinutes || 15) * 60 * 1000;

    beginCountdown(intervalMs);
    await new Promise((resolve) => {
      timeoutRef.current = setTimeout(resolve, intervalMs);
    });
    timeoutRef.current = null;

    if (!activeRef.current) return;
    clearInterval(countdownRef.current);
    setNextFireIn(null);
    const sessionResult = await runSession();

    if (!activeRef.current) return;
    if (
      sessionResult === "paused_permission" ||
      sessionResult === "paused_device_busy"
    )
      return;
    loopRef.current?.();
  };

  const startDaemon = useCallback(() => {
    if (isDaemonActive || activeRef.current) return;
    clearPendingWait();
    setIsDaemonActive(true);
    recentEmotions.current = [];
    activeRef.current = true;
    void (async () => {
      const { bothGranted, state } = await evaluateMediaAccess();
      if (!activeRef.current) return;
      if (!bothGranted) {
        clearPendingWait();
        setNextFireIn(null);
        setDaemonStatus("permission_required");
        logInfo(
          "daemon",
          "daemon waiting for immediate permission grant",
          state,
        );
        return;
      }
      setDaemonStatus("waiting");
      loopRef.current?.();
    })();

    console.log(
      `[Daemon] Started. Interval: ${settingsRef.current.intervalMinutes} min, Duration: ${settingsRef.current.recordDurationMinutes} min`,
    );
    logInfo("daemon", "daemon started", {
      intervalMinutes: settingsRef.current.intervalMinutes,
      recordDurationMinutes: settingsRef.current.recordDurationMinutes,
    });
  }, [isDaemonActive, evaluateMediaAccess, clearPendingWait]);

  const stopDaemon = useCallback(() => {
    logInfo("daemon", "daemon stop requested");
    activeRef.current = false;
    clearPendingWait();

    if (recordingRef.current && recordingRef.current.state === "recording") {
      recordingRef.current.stop();
    }

    setIsDaemonActive(false);
    setDaemonStatus("idle");
    setNextFireIn(null);
    setLiveStream(null);
  }, [clearPendingWait]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      clearPendingWait();
      processingTasksRef.current.clear();
    };
  }, [clearPendingWait]);

  return {
    isDaemonActive,
    daemonStatus,
    nextFireIn,
    liveStream,
    startDaemon,
    stopDaemon,
  };
}
