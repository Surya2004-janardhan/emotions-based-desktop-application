/**
 * useDaemon — Background Monitoring Service
 *
 * Behavior per plan.md requirements #3, #4, #5, #6:
 * - When Auto Mode is ON, loop is: wait `intervalMinutes` -> record `recordDurationMinutes` -> process -> repeat.
 * - After recording: send to Flask /process in background, persist result via IPC.
 * - After processing: detect emotional shift vs. recent history.
 * - If shift detected: fire native OS notification via IPC.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';

const ipc = typeof window !== 'undefined' && window.require
  ? window.require('electron').ipcRenderer
  : null;

const NEGATIVE_EMOTIONS = ['angry', 'sad', 'fearful', 'disgust'];
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
  const [daemonStatus, setDaemonStatus] = useState('idle');
  const [nextFireIn, setNextFireIn] = useState(null);
  const [liveStream, setLiveStream] = useState(null);

  const timeoutRef = useRef(null);
  const countdownRef = useRef(null);
  const recordingRef = useRef(null);
  const recentEmotions = useRef([]);
  const activeRef = useRef(false);
  const loopRef = useRef(null);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const requestStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
      setLiveStream(stream);
      return stream;
    } catch {
      const stream = await navigator.mediaDevices.getUserMedia({ ...MEDIA_CONSTRAINTS, audio: false });
      setLiveStream(stream);
      return stream;
    }
  };

  const releaseStream = (stream) => {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    setLiveStream((current) => (current === stream ? null : current));
  };

  const recordForDuration = useCallback((stream, durationMs) => {
    const mimeType = stream.getAudioTracks().length > 0
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm;codecs=vp8';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];

    return new Promise((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onerror = reject;
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: 'video/webm' }));
      };

      recordingRef.current = recorder;
      recorder.start(200);
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, durationMs);
    });
  }, []);

  const analyzeBlob = useCallback(async (blob) => {
    const formData = new FormData();
    formData.append('video', blob, 'daemon_capture.webm');
    const res = await axios.post('/process', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }, []);

  const detectShift = useCallback((emotion) => {
    if (!emotion) return false;
    if (recentEmotions.current.length === 0) return NEGATIVE_EMOTIONS.includes(emotion);

    const prev = recentEmotions.current[recentEmotions.current.length - 1];
    const changed = prev !== emotion;
    const becameNegative = NEGATIVE_EMOTIONS.includes(emotion) && !NEGATIVE_EMOTIONS.includes(prev);
    return changed && becameNegative;
  }, []);

  const triggerNotification = useCallback(async (emotion) => {
    const currentSettings = settingsRef.current || {};
    const autoPlay = currentSettings.notifyPermission === 'auto';
    const musicPath = currentSettings.musicMappings?.[emotion];

    console.log(`[Daemon] Triggering notification -> ${emotion}. AutoPlay: ${autoPlay}. Music: ${musicPath}`);

    if (onShiftDetected) {
      onShiftDetected({ emotion, musicPath, autoPlay });
    }

    if (ipc) {
      try {
        await ipc.invoke('notify-shift', { emotion, autoPlay: false, musicPath });
        console.log('[Daemon] Notification IPC sent successfully');
      } catch (e) {
        console.error('[Daemon] Notification IPC failed:', e);
      }
    } else if ('Notification' in window) {
      try {
        if (Notification.permission === 'granted') {
          new Notification('EmotionAI - Emotional Shift', {
            body: `Detected shift to ${emotion}.`,
          });
        }
      } catch (e) {
        console.error('[Daemon] Web notification fallback failed:', e);
      }
    }
  }, [onShiftDetected]);

  const runSession = useCallback(async () => {
    const durationMin = settingsRef.current.recordDurationMinutes || 5;
    const durationMs = durationMin * 60 * 1000;
    console.log(`[Daemon] Session start - recording ${durationMin} min`);
    let stream = null;
    let startedAt = null;
    let endedAt = null;

    try {
      startedAt = new Date().toISOString();
      stream = await requestStream();
      setDaemonStatus('recording');

      const blob = await recordForDuration(stream, durationMs);
      endedAt = new Date().toISOString();
      releaseStream(stream);
      stream = null;
      setDaemonStatus('processing');

      const result = await analyzeBlob(blob);

      if (result && !result.error) {
        const emotion = result.fused_emotion;
        console.log(`[Daemon] Analysis done. Emotion: ${emotion}`);
        const enrichedResult = {
          ...result,
          recording_started_at: startedAt,
          recording_ended_at: endedAt,
        };

        const shouldNotify = detectShift(emotion);

        recentEmotions.current.push(emotion);
        if (recentEmotions.current.length > 5) recentEmotions.current.shift();

        if (ipc) await ipc.invoke('save-result', enrichedResult);

        if (onNewResult) onNewResult(enrichedResult);

        if (shouldNotify) {
          await triggerNotification(emotion);
        }
      }
    } catch (err) {
      console.error('[Daemon] Session error:', err);
    } finally {
      releaseStream(stream);
      setDaemonStatus('waiting');
    }
  }, [recordForDuration, analyzeBlob, detectShift, triggerNotification, onNewResult]);

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

    if (!activeRef.current) return;
    clearInterval(countdownRef.current);
    setNextFireIn(null);
    await runSession();

    if (!activeRef.current) return;
    loopRef.current?.();
  };

  const startDaemon = useCallback(() => {
    if (isDaemonActive || activeRef.current) return;
    setIsDaemonActive(true);
    setDaemonStatus('waiting');
    recentEmotions.current = [];
    activeRef.current = true;
    loopRef.current?.();

    console.log(`[Daemon] Started. Interval: ${settingsRef.current.intervalMinutes} min, Duration: ${settingsRef.current.recordDurationMinutes} min`);
  }, [isDaemonActive]);

  const stopDaemon = useCallback(() => {
    activeRef.current = false;
    clearTimeout(timeoutRef.current);
    clearInterval(countdownRef.current);

    if (recordingRef.current && recordingRef.current.state === 'recording') {
      recordingRef.current.stop();
    }

    setIsDaemonActive(false);
    setDaemonStatus('idle');
    setNextFireIn(null);
    setLiveStream(null);
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      clearTimeout(timeoutRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  return {
    isDaemonActive,
    daemonStatus,
    nextFireIn,
    liveStream,
    startDaemon,
    stopDaemon,
  };
}
