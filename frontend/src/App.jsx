import { useState } from 'react';
import Navbar from './components/Navbar';
import RecordingPanel from './components/RecordingPanel';
import ProcessingLoader from './components/ProcessingLoader';
import EmotionCards from './components/EmotionCards';
import TemporalChart from './components/TemporalChart';
import CognitiveInsights from './components/CognitiveInsights';
import AIContent from './components/AIContent';
import Chatbot from './components/Chatbot';
import useMediaRecorder from './hooks/useMediaRecorder';
import useProcessing from './hooks/useProcessing';
import { Brain, RotateCcw, Info, AlertTriangle } from 'lucide-react';

export default function App() {
  const recorder = useMediaRecorder();
  const processing = useProcessing();
  const [phase, setPhase] = useState('idle');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);

  const handleAnalyze = async (input, type) => {
    setPhase('processing');
    if (type === 'file') await processing.processFile(input);
    else await processing.processVideo(input);
    setPhase('results');
  };

  const handleReset = () => {
    processing.reset();
    setPhase('idle');
    setChatKey(k => k + 1); // remount chatbot to clear messages
  };

  return (
    <div className="min-h-screen pb-16">
      <Navbar chatOpen={chatOpen} onToggleChat={() => setChatOpen(!chatOpen)} />
      <div className="h-14" />

      {/* Hero */}
      <header className="text-center pt-10 pb-6 px-4">
        <div className="inline-flex items-center gap-2 mb-3">
          <Brain className="w-5 h-5 text-wattle animate-float" />
          <span className="text-xs font-medium text-wattle/70 uppercase tracking-widest">
            Multimodal Emotion Recognition
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight">
          Discover Your <span className="text-wattle">Emotions</span>
        </h1>
        <p className="mt-2 text-sm text-text-muted max-w-md mx-auto">
          Upload a video - our AI analyzes audio & visual cues to understand your emotional state.
        </p>

        {/* Accuracy note */}
        <div className="mt-4 max-w-xl mx-auto space-y-2">
          <p className="text-[11px] text-text-muted flex items-center justify-center gap-1.5 flex-wrap">
            <Info className="w-3 h-3 text-wattle/50 shrink-0" />
            System accuracy may vary — trained on 25GB of data. Results are indicative, not diagnostic.
          </p>
          <p className="text-[11px] text-text-muted leading-relaxed max-w-lg mx-auto">
            The goal of this project is to make machines understand humans in various scenarios.
            The base model can be used for several use cases like HR screening rounds, therapy session analysis,
            customer sentiment monitoring, interview assessment, and more.
          </p>
        </div>
      </header>

      <main className="px-4 space-y-6">
        {phase === 'idle' && (
          <RecordingPanel recorder={recorder} onAnalyze={handleAnalyze} isProcessing={processing.isProcessing} />
        )}

        {phase === 'processing' && processing.isProcessing && (
          <ProcessingLoader progress={processing.progress} status={processing.status} />
        )}

        {processing.error && (
          <div className="max-w-2xl mx-auto glass rounded-2xl p-5 text-center space-y-3 animate-fade-up" style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-sm text-red-400">{processing.error}</p>
            <button onClick={handleReset} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-wattle transition-colors cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" />
              Try again
            </button>
          </div>
        )}

        {phase === 'results' && processing.results && (
          <div className="space-y-6">
            <CognitiveInsights results={processing.results} />
            <EmotionCards results={processing.results} />
            <TemporalChart results={processing.results} />
            <div className="max-w-4xl mx-auto" style={{ borderTop: '1px dotted rgba(213,207,47,0.15)' }} />
            <AIContent results={processing.results} />
            <div className="flex justify-center pt-4">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl glass text-wattle text-sm font-medium hover:bg-wattle/10 transition-all cursor-pointer"
                style={{ border: '1px solid rgba(213,207,47,0.15)' }}
              >
                <RotateCcw className="w-4 h-4" />
                Analyze Another
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Chatbot */}
      <Chatbot key={chatKey} results={processing.results} isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      <footer className="mt-16 text-center pb-6">
        <p className="text-xs text-text-muted">EmotionAI · Multimodal Emotion Recognition System · Team D7</p>
      </footer>
    </div>
  );
}
