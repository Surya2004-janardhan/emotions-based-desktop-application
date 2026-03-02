import { useState, useRef, useEffect } from 'react';
import { Upload, Video, Camera, StopCircle, RotateCcw } from 'lucide-react';

export default function RecordingPanel({
  recorder,
  onAnalyze,
  isProcessing,
}) {
  const [mode, setMode] = useState('upload');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const fileInputRef = useRef(null);

  const {
    isRecording,
    countdown,
    hasPermission,
    videoRef,
    requestPermission,
    startRecording,
    stopRecording,
    stopStream,
  } = recorder;

  useEffect(() => {
    if (mode === 'live') {
      requestPermission();
    } else {
      stopStream();
    }
  }, [mode]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) { setUploadedFile(file); setRecordingBlob(null); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) { setUploadedFile(file); setRecordingBlob(null); }
  };

  const handleRecord = async () => {
    if (isRecording) { stopRecording(); }
    else {
      setRecordingBlob(null);
      const blob = await startRecording();
      if (blob) setRecordingBlob(blob);
    }
  };

  const handleAnalyze = () => {
    if (mode === 'upload' && uploadedFile) onAnalyze(uploadedFile, 'file');
    else if (mode === 'live' && recordingBlob) onAnalyze(recordingBlob, 'blob');
  };

  const canAnalyze = (mode === 'upload' && uploadedFile) || (mode === 'live' && recordingBlob && !isRecording);

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-up">
      {/* Mode Toggle */}
      <div className="flex justify-center mb-5">
        <div className="inline-flex glass rounded-xl p-1 gap-1">
          <button
            onClick={() => { setMode('upload'); setRecordingBlob(null); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer ${
              mode === 'upload'
                ? 'bg-wattle/20 text-wattle'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
          <button
            onClick={() => { setMode('live'); setUploadedFile(null); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer ${
              mode === 'live'
                ? 'bg-wattle/20 text-wattle'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Camera className="w-4 h-4" />
            Live
          </button>
        </div>
      </div>

      {/* Upload Area — entire div is clickable */}
      {mode === 'upload' && (
        <div
          className={`glass glow-border rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer ${dragOver ? 'scale-[1.01]' : ''}`}
          style={dragOver ? { borderColor: 'rgba(213,207,47,0.4)', background: 'rgba(213,207,47,0.05)' } : {}}
          onClick={() => { if (!uploadedFile) fileInputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploadedFile ? (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(213,207,47,0.1)' }}>
                <Video className="w-8 h-8 text-wattle" />
              </div>
              <p className="text-text-primary font-medium text-base">{uploadedFile.name}</p>
              <p className="text-text-muted text-sm">{(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
              <button
                onClick={(e) => { e.stopPropagation(); setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-wattle transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Change file
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(122,42,61,0.4)' }}>
                <Upload className="w-8 h-8 text-text-muted" />
              </div>
              <div>
                <p className="text-text-secondary text-base">
                  Click to select a video, or drag & drop
                </p>
                <p className="text-text-muted text-xs mt-1.5">MP4, WebM, AVI — up to 100 MB</p>
              </div>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {/* Live Recording Area — compact with mirror preview */}
      {mode === 'live' && (
        <div className="glass glow-border rounded-2xl overflow-hidden max-w-md mx-auto">
          {/* Camera mirror — muted so user hears no echo, mirrored with scaleX */}
          <div className="relative bg-cherry-dark flex items-center justify-center" style={{ aspectRatio: '4/3' }}>
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
              <div className="text-center space-y-2 p-6">
                <Camera className="w-8 h-8 mx-auto text-text-muted" />
                <p className="text-text-secondary text-xs">Requesting camera access...</p>
              </div>
            )}

            {/* Countdown overlay */}
            {isRecording && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                  <div className="absolute -inset-3 rounded-full animate-pulse-ring" style={{ border: '2px solid rgba(239,68,68,0.4)' }} />
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <span className="text-2xl font-bold text-white tabular-nums">{countdown}</span>
                  </div>
                </div>
              </div>
            )}

            {/* REC badge */}
            {isRecording && (
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-medium text-white">REC</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-4 flex justify-center">
            {!isRecording ? (
              <button
                onClick={handleRecord}
                disabled={!hasPermission}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-wattle font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ background: 'rgba(213,207,47,0.08)', border: '1px solid rgba(213,207,47,0.2)' }}
              >
                <Camera className="w-4 h-4" />
                Record
                <span className="text-text-muted text-xs ml-0.5">(11s)</span>
              </button>
            ) : (
              <button
                onClick={handleRecord}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-red-400 font-medium text-sm transition-all cursor-pointer"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <StopCircle className="w-4 h-4" />
                Stop
              </button>
            )}
          </div>

          {/* Recorded confirmation */}
          {recordingBlob && !isRecording && (
            <div className="px-4 pb-3 text-center">
              <p className="text-xs text-em-happy flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-em-happy inline-block" />
                Ready to analyze
              </p>
            </div>
          )}
        </div>
      )}

      {/* Analyze Button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze || isProcessing}
          className="px-10 py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300 cursor-pointer
            disabled:opacity-30 disabled:cursor-not-allowed
            bg-gradient-to-r from-wattle-dark via-wattle to-wattle-light text-cherry-dark
            hover:shadow-lg hover:scale-[1.02]
            active:scale-[0.98]"
          style={{ boxShadow: canAnalyze ? '0 8px 24px rgba(213,207,47,0.15)' : 'none' }}
        >
          Analyze Emotions
        </button>
      </div>
    </div>
  );
}
