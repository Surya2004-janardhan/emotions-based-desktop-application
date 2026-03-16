import { useState, useEffect, useRef, useCallback } from 'react';
import useMediaRecorder from './hooks/useMediaRecorder';
import useProcessing from './hooks/useProcessing';
import useDaemon from './hooks/useDaemon';
import useSettings from './hooks/useSettings';
import axios from 'axios';

import RecordingPanel from './components/RecordingPanel';
import ProcessingLoader from './components/ProcessingLoader';
import EmotionCards from './components/EmotionCards';
import TemporalChart from './components/TemporalChart';
import CognitiveInsights from './components/CognitiveInsights';
import AIContent from './components/AIContent';
import Chatbot from './components/Chatbot';
import CalendarView from './components/CalendarView';
import SettingsView from './components/SettingsView';

import { Brain, LayoutDashboard, CalendarRange, SlidersHorizontal, MessageCircle, Activity, ChevronRight, RotateCcw, AlertTriangle } from 'lucide-react';

const ipc = typeof window !== 'undefined' && window.require
  ? window.require('electron').ipcRenderer
  : null;

export default function App() {
  const recorder    = useMediaRecorder();
  const processing  = useProcessing();
  const { settings, loaded, save } = useSettings();

  const [currentTab, setCurrentTab] = useState('dashboard');
  const [phase, setPhase] = useState('idle');           // idle | processing | results
  const [chatOpen, setChatOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [lastDaemonResult, setLastDaemonResult] = useState(null);
  const audioRef = useRef(null);

  // ── Daemon ─────────────────────────────────────────────────
  const { isDaemonActive, daemonStatus, nextFireIn, startDaemon, stopDaemon } = useDaemon({
    settings,
    onNewResult: (result) => setLastDaemonResult(result),
  });

  // ── Auto Mode sync from settings ──────────────────────────
  useEffect(() => {
    if (!loaded) return;
    if (settings.autoMode && !isDaemonActive) startDaemon();
    if (!settings.autoMode && isDaemonActive) stopDaemon();
  }, [loaded, settings.autoMode]); // eslint-disable-line

  // ── Manual analysis ───────────────────────────────────────
  const handleAnalyze = useCallback(async (input, type) => {
    setPhase('processing');

    // Start backend on demand before processing
    if (ipc) {
      const status = await ipc.invoke('backend-status');
      if (!status.running) {
        await ipc.invoke('start-backend');
        await new Promise(r => setTimeout(r, 4000));
      }
    }

    if (type === 'file') await processing.processFile(input);
    else await processing.processVideo(input);

    setPhase('results');
  }, [processing]);

  const handleReset = () => {
    processing.reset();
    setPhase('idle');
    setChatKey(k => k + 1);
  };

  // ── Format countdown ──────────────────────────────────────
  const fmtCountdown = (secs) => {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}m ${s.toString().padStart(2,'0')}s`;
  };

  // ── Sidebar nav items ─────────────────────────────────────
  const navItems = [
    { id: 'dashboard', label: 'Dashboard',  Icon: LayoutDashboard },
    { id: 'calendar',  label: 'History',    Icon: CalendarRange },
    { id: 'settings',  label: 'Settings',   Icon: SlidersHorizontal },
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

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-border-subtle bg-surface-base">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border-subtle">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Brain className="w-5 h-5 text-primary" strokeWidth={2.5} />
          </div>
          <span className="text-base font-black text-text-primary tracking-tight">
            Emotion<span className="text-primary">AI</span>
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ id, label, Icon }) => (
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
                <Icon className="w-4 h-4" />
                {label}
              </div>
              {currentTab === id && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </button>
          ))}
        </nav>

        {/* Auto Mode toggle */}
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
              </div>
            ) : (
              <p className="text-[10px] text-text-muted leading-relaxed">
                Runs every {settings.intervalMinutes} min, records {settings.recordDurationMinutes} min
              </p>
            )}
          </div>
        </div>

        {/* Chat button */}
        <div className="px-3 pb-4">
          <button
            onClick={() => setChatOpen(o => !o)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              chatOpen ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            AI Assistant
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 text-[9px] text-text-muted border-t border-border-subtle">
          D7 · Final Year Project
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Dashboard */}
          {currentTab === 'dashboard' && (
            <div className="space-y-8 animate-fade-up">
              <div>
                <h1 className="text-2xl font-black text-text-primary">Dashboard</h1>
                <p className="text-sm text-text-muted mt-1">Live emotional monitoring for workplace well-being.</p>
              </div>

              {phase === 'idle' && (
                <RecordingPanel
                  recorder={recorder}
                  onAnalyze={handleAnalyze}
                  isProcessing={processing.isProcessing}
                />
              )}

              {phase === 'processing' && processing.isProcessing && (
                <ProcessingLoader progress={processing.progress} status={processing.status} />
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

              {/* Latest Daemon Result inline */}
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

          {/* Calendar / History */}
          {currentTab === 'calendar' && (
            <CalendarView />
          )}

          {/* Settings */}
          {currentTab === 'settings' && (
            <SettingsView settings={settings} onSave={save} />
          )}
        </div>
      </main>

      {/* Chatbot overlay */}
      <Chatbot key={chatKey} results={processing.results} isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Hidden audio for intervention playback */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
