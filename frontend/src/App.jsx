import { useState, useEffect, useRef, useCallback } from 'react';
import useMediaRecorder from './hooks/useMediaRecorder';
import useProcessing from './hooks/useProcessing';
import useDaemon from './hooks/useDaemon';
import useSettings from './hooks/useSettings';

import RecordingPanel from './components/RecordingPanel';
import ProcessingLoader from './components/ProcessingLoader';
import EmotionCards from './components/EmotionCards';
import TemporalChart from './components/TemporalChart';
import CognitiveInsights from './components/CognitiveInsights';
import AIContent from './components/AIContent';
import Chatbot from './components/Chatbot';
import CalendarView from './components/CalendarView';
import SettingsView from './components/SettingsView';
import InterventionPopup from './components/InterventionPopup';

import { Brain, LayoutDashboard, CalendarRange, SlidersHorizontal, MessageCircle, Activity, ChevronRight, RotateCcw, AlertTriangle } from 'lucide-react';

const ipc = typeof window !== 'undefined' && window.require
  ? window.require('electron').ipcRenderer
  : null;

export default function App() {
  const recorder = useMediaRecorder();
  const processing = useProcessing();
  const { settings, loaded, save } = useSettings();

  const [currentTab, setCurrentTab] = useState('dashboard');
  const [phase, setPhase] = useState('idle');
  const [manualMeta, setManualMeta] = useState(null);
  const [manualPreviewUrl, setManualPreviewUrl] = useState(null);
  const [lastDaemonResult, setLastDaemonResult] = useState(null);
  const [musicNowPlaying, setMusicNowPlaying] = useState(null);
  const daemonVideoRef = useRef(null);
  const audioRef = useRef(null);
  const musicQueueRef = useRef([]);
  const musicPlayingRef = useRef(false);
  const activeInsight = processing.results || lastDaemonResult;

  const tryPlayNext = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || musicPlayingRef.current) return;
    const nextTrack = musicQueueRef.current.shift();
    if (!nextTrack) return;

    musicPlayingRef.current = true;
    setMusicNowPlaying(nextTrack);

    const src = nextTrack.musicPath.startsWith('file://')
      ? nextTrack.musicPath
      : `file://${encodeURI(nextTrack.musicPath)}`;

    audio.src = src;
    audio.play().catch(() => {
      musicPlayingRef.current = false;
      setMusicNowPlaying(null);
    });
  }, []);

  const { isDaemonActive, daemonStatus, nextFireIn, liveStream, startDaemon, stopDaemon } = useDaemon({
    settings,
    onNewResult: (result) => setLastDaemonResult(result),
    onShiftDetected: ({ emotion, musicPath, autoPlay }) => {
      if (!autoPlay || !musicPath) return;
      musicQueueRef.current.push({ emotion, musicPath, at: Date.now() });
      tryPlayNext();
    },
  });

  useEffect(() => {
    if (!loaded) return;
    if (settings.autoMode && !isDaemonActive) startDaemon();
    if (!settings.autoMode && isDaemonActive) stopDaemon();
  }, [loaded, settings.autoMode]); // eslint-disable-line

  useEffect(() => {
    if (!daemonVideoRef.current) return;
    daemonVideoRef.current.srcObject = liveStream || null;
  }, [liveStream, daemonStatus]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleStop = () => {
      musicPlayingRef.current = false;
      setMusicNowPlaying(null);
      setTimeout(() => tryPlayNext(), 150);
    };
    audio.addEventListener('ended', handleStop);
    audio.addEventListener('pause', handleStop);

    return () => {
      audio.removeEventListener('ended', handleStop);
      audio.removeEventListener('pause', handleStop);
    };
  }, [tryPlayNext]);

  useEffect(() => {
    return () => {
      if (manualPreviewUrl) URL.revokeObjectURL(manualPreviewUrl);
    };
  }, [manualPreviewUrl]);

  const handleAnalyze = useCallback(async (input, type) => {
    setPhase('processing');
    const meta = recorder.lastCaptureMeta || {
      startedAt: new Date(Date.now() - 11000).toISOString(),
      endedAt: new Date().toISOString(),
    };
    setManualMeta(meta);

    if (manualPreviewUrl) {
      URL.revokeObjectURL(manualPreviewUrl);
      setManualPreviewUrl(null);
    }
    if (type === 'blob' && input instanceof Blob) {
      setManualPreviewUrl(URL.createObjectURL(input));
    }

    if (ipc) {
      const status = await ipc.invoke('backend-status');
      if (!status.running) {
        await ipc.invoke('start-backend');
        await new Promise(r => setTimeout(r, 4000));
      }
    }

    let result = null;
    if (type === 'file') result = await processing.processFile(input);
    else result = await processing.processVideo(input);

    if (ipc && result && !result.error) {
      await ipc.invoke('save-result', {
        ...result,
        recording_started_at: meta.startedAt,
        recording_ended_at: meta.endedAt,
      });
    }

    setPhase('results');
  }, [processing, recorder.lastCaptureMeta, manualPreviewUrl]);

  const handleReset = () => {
    processing.reset();
    if (manualPreviewUrl) {
      URL.revokeObjectURL(manualPreviewUrl);
      setManualPreviewUrl(null);
    }
    setManualMeta(null);
    setPhase('idle');
  };

  const fmtCountdown = (secs) => {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'calendar', label: 'History', icon: <CalendarRange className="w-4 h-4" /> },
    { id: 'assistant', label: 'AI Assistant', icon: <MessageCircle className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <SlidersHorizontal className="w-4 h-4" /> },
  ];

  if (!loaded) return (
    <div className="flex items-center justify-center h-screen bg-bg-base">
      <div className="flex flex-col items-center gap-4 text-text-muted">
        <Brain className="w-10 h-10 text-primary animate-pulse" />
        <span className="text-sm font-medium">Loading EmotionAI...</span>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base text-text-primary">
      <InterventionPopup results={activeInsight} />

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
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-3">
                {icon}
                {label}
              </div>
              {currentTab === id && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-border-subtle">
          <div className="px-3 py-3 rounded-xl bg-surface-raised border border-border-subtle">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Auto Mode</span>
              <button
                onClick={() => save({ autoMode: !settings.autoMode })}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  settings.autoMode ? 'bg-primary' : 'bg-border-strong'
                }`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  settings.autoMode ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {isDaemonActive ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                    {daemonStatus === 'recording' ? 'Recording...' : daemonStatus === 'processing' ? 'Analyzing...' : 'Monitoring'}
                  </span>
                </div>
                {nextFireIn && daemonStatus === 'waiting' && (
                  <p className="text-[10px] text-text-muted">Next: {fmtCountdown(nextFireIn)}</p>
                )}
                {musicNowPlaying && (
                  <p className="text-[10px] text-primary font-semibold">
                    Playing support track for {musicNowPlaying.emotion}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-text-muted leading-relaxed">
                Runs every {settings.intervalMinutes} min, records {settings.recordDurationMinutes} min
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
          {currentTab === 'dashboard' && (
            <div className="space-y-8 animate-fade-up">
              <div>
                <h1 className="text-2xl font-black text-text-primary">Dashboard</h1>
                <p className="text-sm text-text-muted mt-1">Track emotion-driven stress patterns for workplace well-being over time.</p>
              </div>

              {phase === 'idle' && (
                <RecordingPanel
                  recorder={recorder}
                  onAnalyze={handleAnalyze}
                  isProcessing={processing.isProcessing}
                />
              )}

              {phase === 'processing' && processing.isProcessing && (
                <ProcessingLoader
                  progress={processing.progress}
                  status={processing.status}
                  previewUrl={manualPreviewUrl}
                  recordingMeta={manualMeta}
                />
              )}

              {isDaemonActive && (daemonStatus === 'recording' || daemonStatus === 'processing') && (
                <div className="panel p-5 border border-primary/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-primary animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-text-primary">
                      {daemonStatus === 'recording' ? 'Background Recording Live' : 'Recording Complete · Processing'}
                    </span>
                  </div>
                  <div className="relative rounded-xl overflow-hidden border border-border-subtle bg-black/70">
                    {daemonStatus === 'recording' ? (
                      <video
                        ref={daemonVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full max-h-[300px] object-cover"
                        style={{ transform: 'scaleX(-1)' }}
                      />
                    ) : (
                      <div className="h-[180px] flex items-center justify-center text-sm text-white/80">
                        Processing captured stream in background...
                      </div>
                    )}
                    <div className="absolute top-3 right-3 px-3 py-1 rounded-md bg-black/60 text-[11px] font-bold text-white uppercase tracking-wider">
                      {daemonStatus}
                    </div>
                  </div>
                </div>
              )}

              {processing.error && (
                <div className="panel p-6 text-center space-y-3 border-red-500/30">
                  <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
                  <p className="text-sm font-medium text-red-500">{processing.error}</p>
                  <button onClick={handleReset} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-surface-raised text-sm font-bold border border-border-subtle cursor-pointer hover:bg-surface-raised/80 transition-all">
                    <RotateCcw className="w-4 h-4" /> Try Again
                  </button>
                </div>
              )}

              {phase === 'results' && processing.results && (
                <div className="space-y-8 stagger">
                  <CognitiveInsights results={processing.results} />
                  <EmotionCards results={processing.results} />
                  <TemporalChart results={processing.results} />
                  <div className="border-t border-border-subtle pt-8">
                    <AIContent results={processing.results} />
                  </div>
                  <div className="flex justify-center pt-4">
                    <button onClick={handleReset} className="group flex items-center gap-2 px-8 py-3 rounded-xl bg-surface-raised text-sm font-bold border border-border-subtle hover:border-primary/40 hover:text-primary transition-all cursor-pointer">
                      <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                      New Session
                    </button>
                  </div>
                </div>
              )}

              {lastDaemonResult && !processing.results && phase === 'idle' && (
                <div className="panel p-5 border border-border-subtle animate-fade-up">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-primary animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Latest Background Reading</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="px-4 py-2 rounded-xl bg-surface-raised border border-border-subtle">
                      <p className="text-xs text-text-muted">Emotion</p>
                      <p className="text-lg font-black capitalize" style={{ color: `var(--color-em-${lastDaemonResult.fused_emotion})` }}>
                        {lastDaemonResult.fused_emotion}
                      </p>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">{lastDaemonResult.reasoning}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentTab === 'calendar' && (
            <CalendarView />
          )}

          {currentTab === 'settings' && (
            <SettingsView settings={settings} onSave={save} />
          )}

          {currentTab === 'assistant' && (
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
