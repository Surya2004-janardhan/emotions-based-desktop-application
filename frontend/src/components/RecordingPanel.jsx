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
    <div className="absolute bottom-4 left-4 right-4 h-12 bg-primary/18 backdrop-blur-md rounded-xl overflow-hidden border border-primary/20 flex items-center px-4 gap-3">
      <Mic className="w-4 h-4 text-blue-100 animate-pulse shrink-0" />
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
    <div className="w-full max-w-3xl mx-auto animate-fade-up">
      <div className="relative">
        <div className="panel overflow-hidden rounded-[28px] border-primary/20 shadow-[0_24px_80px_rgba(59,130,246,0.12)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(147,197,253,0.28),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(219,234,254,0.8),transparent_32%)] pointer-events-none" />

          <div className="relative flex items-center justify-between px-5 py-4 border-b border-primary/10 bg-white/80 backdrop-blur-xl">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Capture Workspace</p>
              <h2 className="text-lg font-black text-text-primary">Manual Stress Check</h2>
            </div>
            <div className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
              isRecording
                ? 'bg-red-50 text-red-600 border-red-200'
                : hasPermission
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-surface-raised text-text-secondary border-border-subtle'
            }`}>
              {isRecording ? 'Recording' : hasPermission ? 'Ready' : 'Permission Needed'}
            </div>
          </div>

          <div className="relative flex items-center justify-center min-h-[360px] px-8 py-10" style={{ aspectRatio: '16/9' }}>
            {hasPermission ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="hidden"
                />
                {isRecording ? (
                  <div className="text-center space-y-5 max-w-md">
                    <div className="relative w-24 h-24 mx-auto">
                      <div className="absolute inset-0 rounded-full bg-primary/12 animate-pulse-ring" />
                      <div className="relative w-24 h-24 rounded-full border border-primary/20 bg-white shadow-lg flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-text-primary text-base font-bold">Background capture is running</p>
                      <p className="text-text-secondary text-sm leading-relaxed">
                        The app is collecting camera and microphone input in the background for this session.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                      Session in progress
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4 max-w-md">
                    <div className="w-16 h-16 mx-auto rounded-3xl bg-primary/10 border border-primary/15 flex items-center justify-center shadow-sm">
                      <Camera className="w-8 h-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-text-primary text-sm font-semibold">Devices are ready for a manual check.</p>
                      <p className="text-text-secondary text-xs leading-relaxed">
                        Start capture when you want to begin. The app keeps the camera view hidden and only shows simple session state here.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-primary/10 border border-primary/15 flex items-center justify-center shadow-sm">
                  <Camera className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-text-primary text-sm font-semibold">Camera and microphone access is required.</p>
                  <p className="text-text-secondary text-xs leading-relaxed">
                    We only start once both devices are available, and the app stays paused if another meeting app is using them.
                  </p>
                </div>
                <button
                  onClick={requestPermission}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold cursor-pointer hover:opacity-90 transition-all"
                >
                  <Mic className="w-3.5 h-3.5" />
                  Enable Camera and Mic
                </button>
              </div>
            )}

            {!hasPermission && recorder.permissionError && (
              <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-[11px] text-red-600 font-medium">
                  Permission issue: {recorder.permissionError}
                </p>
              </div>
            )}

            {isRecording && (
              <>
                <div className="absolute inset-0 bg-primary/4 pointer-events-none" />
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-primary/15 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
                  <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Session Live</span>
                </div>
              </>
            )}
            <AudioVisualizer stream={recorder.stream} />
          </div>

          <div className="relative px-6 py-6 bg-gradient-to-r from-white to-primary/5 border-t border-primary/10 space-y-4">
            {!isRecording ? (
              <button
                onClick={handleRecord}
                disabled={!hasPermission}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-primary text-bg-base font-bold text-sm transition-all hover:scale-[1.01] hover:shadow-lg hover:shadow-primary/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Start Capture
              </button>
            ) : (
              <button
                onClick={handleRecord}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-red-500 text-white font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <StopCircle className="w-4 h-4" />
                Terminate Session
              </button>
            )}

            {recordingBlob && !isRecording && (
              <p className="text-sm font-medium text-primary flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                Recording captured and ready for analysis
              </p>
            )}

            <p className="text-[11px] text-text-secondary leading-relaxed">
              Camera data and audio streams are used to understand stress-related emotional patterns.
              Lighting, background noise, and resolution may influence confidence.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-4">
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
