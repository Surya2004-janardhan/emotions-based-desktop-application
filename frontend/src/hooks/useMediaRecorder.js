import { useState, useRef, useCallback, useEffect } from 'react';

const MEDIA_CONSTRAINTS = {
  video: {
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 15, max: 24 },
  },
  audio: true,
};

export default function useMediaRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(11);
  const [stream, setStream] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [lastCaptureMeta, setLastCaptureMeta] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const videoRef = useRef(null);

  // Keep the video element in sync with the stream whenever stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Callback ref — component calls this when <video> mounts/unmounts
  const setVideoElement = useCallback((el) => {
    videoRef.current = el;
    if (el && stream) {
      el.srcObject = stream;
    }
  }, [stream]);

  const requestPermission = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
      setStream(s);
      setHasPermission(true);
      setPermissionError(null);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
      return s;
    } catch (err) {
      console.error('Permission denied for video+audio:', err);
      // Fallback: allow camera-only capture if microphone is blocked/unavailable.
      try {
        const s = await navigator.mediaDevices.getUserMedia({ ...MEDIA_CONSTRAINTS, audio: false });
        setStream(s);
        setHasPermission(true);
        setPermissionError('Microphone unavailable. Using camera-only mode.');
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        return s;
      } catch (fallbackErr) {
        console.error('Permission denied for camera fallback:', fallbackErr);
        setHasPermission(false);
        setPermissionError(fallbackErr?.message || 'Camera/microphone access blocked.');
        return null;
      }
    }
  }, []);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
      setHasPermission(false);
      setPermissionError(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  const startRecording = useCallback(async () => {
    let s = stream;
    if (!s) {
      s = await requestPermission();
      if (!s) return null;
    }

    chunksRef.current = [];

    const hasAudio = s.getAudioTracks().length > 0;
    const mimeType = hasAudio ? 'video/webm;codecs=vp8,opus' : 'video/webm;codecs=vp8';
    const recorder = new MediaRecorder(s, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    return new Promise((resolve) => {
      const startedAt = new Date().toISOString();
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        chunksRef.current = [];
        setIsRecording(false);
        clearInterval(timerRef.current);
        setCountdown(11);
        setLastCaptureMeta({
          startedAt,
          endedAt: new Date().toISOString(),
        });
        resolve(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecording(true);
      setCountdown(11);

      let sec = 11;
      timerRef.current = setInterval(() => {
        sec -= 1;
        setCountdown(sec);
        if (sec <= 0) {
          clearInterval(timerRef.current);
          if (recorder.state === 'recording') recorder.stop();
        }
      }, 1000);
    });
  }, [stream, requestPermission]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      clearInterval(timerRef.current);
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    isRecording,
    countdown,
    stream,
    hasPermission,
    permissionError,
    lastCaptureMeta,
    videoRef: setVideoElement, // callback ref so mirror works immediately
    requestPermission,
    stopStream,
    startRecording,
    stopRecording,
  };
}
