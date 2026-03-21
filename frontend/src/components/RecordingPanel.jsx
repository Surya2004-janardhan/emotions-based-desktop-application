import { useState, useRef, useEffect } from 'react';
import { Camera, StopCircle, Mic } from 'lucide-react';

const AudioVisualizer = ({ stream }) => {
  const canvasRef = useRef(null);
  const rafIdRef = useRef(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;

    const audioStream = new MediaStream(audioTracks);
    const source = audioCtx.createMediaStreamSource(audioStream);
    source.connect(analyser);

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!canvasRef.current) return;

      const width = canvas.width;
      const height = canvas.height;

      rafIdRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      canvasCtx.clearRect(0, 0, width, height);
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      canvasCtx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      canvasCtx.lineTo(width, height / 2);
      canvasCtx.stroke();
    };

    draw();

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (audioCtx.state !== 'closed') audioCtx.close();
    };
  }, [stream]);

  if (!stream || stream.getAudioTracks().length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 h-12 bg-black/50 backdrop-blur-md rounded-xl overflow-hidden border border-white/10 flex items-center px-4 gap-3">
      <Mic className="w-4 h-4 text-sky-400 animate-pulse shrink-0" />
      <canvas ref={canvasRef} width={300} height={40} className="w-full h-full" />
    </div>
  );
};

export default function RecordingPanel({
  recorder,
  onAnalyze,
  isProcessing,
}) {
  const [recordingBlob, setRecordingBlob] = useState(null);

  const {
    isRecording,
    countdown,
    hasPermission,
    videoRef,
    requestPermission,
    startRecording,
    stopRecording,
  } = recorder;

  useEffect(() => {
    return () => {
      recorder.stopStream?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRecord = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      setRecordingBlob(null);
      const blob = await startRecording();
      if (blob) setRecordingBlob(blob);
    }
  };

  const handleAnalyze = () => {
    if (recordingBlob) onAnalyze(recordingBlob, 'blob');
  };

  const canAnalyze = recordingBlob && !isRecording;

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-up">
      <div className="relative">
        <div className="glass glow-border rounded-xl overflow-hidden max-w-md mx-auto">
          <div className="relative bg-surface-base flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
            {hasPermission ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            ) : (
              <div className="text-center space-y-3 p-8">
                <div className="w-12 h-12 mx-auto rounded-full bg-surface-raised flex items-center justify-center">
                  <Camera className="w-6 h-6 text-text-muted" />
                </div>
                <p className="text-text-secondary text-sm">Camera and microphone access is required for analysis.</p>
                <button
                  onClick={requestPermission}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold cursor-pointer hover:opacity-90 transition-all"
                >
                  <Mic className="w-3.5 h-3.5" />
                  Enable Camera and Mic
                </button>
              </div>
            )}

            {!hasPermission && recorder.permissionError && (
              <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
                <p className="text-[11px] text-red-600 font-medium">
                  Permission issue: {recorder.permissionError}
                </p>
              </div>
            )}

            {isRecording && (
              <>
                <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 rounded-md bg-black/60 backdrop-blur-md">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">Session Live</span>
                </div>
              </>
            )}

            {isRecording && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-20 h-20 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-lg border border-primary/30">
                  <span className="text-3xl font-bold text-primary tabular-nums drop-shadow-lg">{countdown}</span>
                </div>
              </div>
            )}

            <AudioVisualizer stream={recorder.stream} />
          </div>

          <div className="p-6 flex flex-col items-center gap-4">
            {!isRecording ? (
              <button
                onClick={handleRecord}
                disabled={!hasPermission}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-lg bg-primary text-bg-base font-bold text-sm transition-all hover:scale-[1.01] hover:shadow-lg hover:shadow-primary/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Start Capture
                <span className="opacity-70 font-medium">(11s)</span>
              </button>
            ) : (
              <button
                onClick={handleRecord}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-lg bg-red-500 text-white font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <StopCircle className="w-4 h-4" />
                Terminate Session
              </button>
            )}

            {recordingBlob && !isRecording && (
              <p className="text-sm font-medium text-primary flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                Temporal segment captured
              </p>
            )}

            <p className="text-[10px] text-text-muted text-center leading-relaxed max-w-xs">
              Camera data and audio streams are used to understand stress-related emotional patterns.
              Lighting, background noise, and resolution may influence confidence.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-center gap-4">
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze || isProcessing}
          className={`
            relative group px-12 py-4 rounded-xl font-bold text-sm tracking-widest uppercase transition-all duration-300
            ${canAnalyze && !isProcessing
              ? 'bg-gradient-to-r from-primary to-primary-light text-bg-base shadow-xl shadow-primary/25 cursor-pointer hover:-translate-y-1 hover:shadow-primary/40'
              : 'bg-surface-raised text-text-muted cursor-not-allowed opacity-50'}
            overflow-hidden
          `}
        >
          <span className="relative z-10">Run Stress Analysis</span>
          {canAnalyze && !isProcessing && (
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          )}
        </button>

        {!canAnalyze && !isProcessing && (
          <span className="text-xs text-text-muted animate-pulse">Awaiting input stream...</span>
        )}
      </div>
    </div>
  );
}
