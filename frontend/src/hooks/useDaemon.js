/**
 * useDaemon — Background Monitoring Service
 *
 * Behavior per plan.md requirements #3, #4, #5, #6:
 * - When Auto Mode is ON, loop is: wait `intervalMinutes` -> record `recordDurationMinutes` -> process -> repeat.
 * - After recording: send to Flask /process in background, persist result via IPC.
 * - After processing: detect emotional shift vs. recent history.
 * - If shift detected: fire native OS notification via IPC.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

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

  const timeoutRef     = useRef(null);
  const countdownRef   = useRef(null);
  const recordingRef   = useRef(null);
  const recentEmotions = useRef([]); // rolling buffer of last 5 results
  const activeRef      = useRef(false);
  // Always-fresh settings to avoid stale closure bugs in callbacks
  const settingsRef    = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ── Helpers ───────────────────────────────────────────────
  const requestStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
      setLiveStream(stream);
      return stream;
    } catch {
      // Fallback to camera-only so monitoring can continue when mic is denied.
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
    return new Promise((resolve) => {
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      recordingRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));

      recorder.start(200);
      setDaemonStatus('recording');

      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, durationMs);
    });
  }, []);

  const analyzeBlob = useCallback(async (blob) => {
    // Ensure backend is running before sending
    if (ipc) {
      const status = await ipc.invoke('backend-status');
      if (!status.running) {
        await ipc.invoke('start-backend');
        // Wait a moment for it to be ready
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    const formData = new FormData();
    formData.append('video', blob, 'daemon_recording.webm');

    const { default: axios } = await import('axios');
    const { data } = await axios.post('http://127.0.0.1:5000/process', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 min timeout for long recordings
    });
    return data;
  }, []);

  const detectShift = useCallback((newEmotion) => {
    const history = recentEmotions.current;
    // newEmotion is NOT yet in history when this is called
    if (!NEGATIVE_EMOTIONS.includes(newEmotion)) return false; // Only notify on negative emotions

    const prev = history[history.length - 1]; // last confirmed emotion before current
    if (!prev) return true; // first reading ever, and it's negative → always notify

    const wasPositive = !NEGATIVE_EMOTIONS.includes(prev);

    // Trigger if: was positive and now negative, OR 2+ negatives in a row
    const recentNeg = history.slice(-2).filter(e => NEGATIVE_EMOTIONS.includes(e)).length;
    return wasPositive || recentNeg >= 2;
  }, []);

  const triggerNotification = useCallback(async (emotion) => {
    // Use ref to get always-fresh settings (avoids stale closure)
    const { notifyPermission, musicMappings } = settingsRef.current;
    const musicPath = musicMappings?.[emotion] || null;
    const autoPlay  = notifyPermission === 'auto';

    console.log(`[Daemon] Triggering notification → ${emotion}. AutoPlay: ${autoPlay}. Music: ${musicPath}`);

    if (onShiftDetected) {
      onShiftDetected({ emotion, musicPath, autoPlay });
    }

    if (ipc) {
      try {
        await ipc.invoke('notify-shift', { emotion, autoPlay: false, musicPath });
        console.log('[Daemon] Notification IPC sent successfully');
      } catch(e) {
        console.error('[Daemon] Notification IPC failed:', e);
      }
    } else {
      // Fallback: web Notification API
      try {
        if (Notification.permission !== 'granted') {
          await Notification.requestPermission();
        }
        new Notification('EmotionAI – Shift Detected', {
          body: `Detected shift to ${emotion}. ${autoPlay ? 'Playing music.' : 'Open app to respond.'}`
        });
      } catch(e) {
        console.error('[Daemon] Web notification fallback failed:', e);
      }
    }
  }, [onShiftDetected]);  // reads from settingsRef.current at call time


  // ── Core Session ──────────────────────────────────────────
  const runSession = useCallback(async () => {
    const durationMin = settingsRef.current.recordDurationMinutes || 5;
    const durationMs = durationMin * 60 * 1000;
    console.log(`[Daemon] Session start — recording ${durationMin} min`);
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

        // Detect shift BEFORE pushing into history
        const shouldNotify = detectShift(emotion);

        // Now update rolling buffer
        recentEmotions.current.push(emotion);
        if (recentEmotions.current.length > 5) recentEmotions.current.shift();

        // Persist result via IPC
        if (ipc) await ipc.invoke('save-result', enrichedResult);

        // Notify parent
        if (onNewResult) onNewResult(enrichedResult);

        // Fire notification if shift detected
        if (shouldNotify) {
          console.log(`[Daemon] Shift confirmed — firing notification for ${emotion}`);
          await triggerNotification(emotion);
        }

        // Celebrate improvements (#15)
        const wasNeg = NEGATIVE_EMOTIONS.includes(recentEmotions.current.slice(-2)[0] || '');
        const isNowPos = ['happy', 'neutral'].includes(emotion);
        if (wasNeg && isNowPos && ipc) {
          ipc.invoke('notify-shift', {
            emotion,
            autoPlay: false,
            musicPath: null,
            // Override body (main.cjs handles the positive case too)
            positive: true,
          });
        }
      }
    } catch(err) {
      console.error('[Daemon] Session error:', err);
    } finally {
      releaseStream(stream);
      setDaemonStatus('waiting');
    }
  }, [recordForDuration, analyzeBlob, detectShift, triggerNotification, onNewResult]);

  // ── Start / Stop ──────────────────────────────────────────
  const beginCountdown = useCallback((intervalMs) => {
    clearInterval(countdownRef.current);
    let secsLeft = Math.ceil(intervalMs / 1000);
    setNextFireIn(secsLeft);
    countdownRef.current = setInterval(() => {
      secsLeft -= 1;
      setNextFireIn(Math.max(0, secsLeft));
    }, 1000);
  }, []);

  const loopRef = useRef(null);
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
    console.log('[Daemon] Stopped.');
  }, []);

  // Cleanup on unmount
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
