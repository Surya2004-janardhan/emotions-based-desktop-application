import { useState } from 'react';
import Navbar from './components/Navbar';
import RecordingPanel from './components/RecordingPanel';
import ProcessingLoader from './components/ProcessingLoader';
import EmotionCards from './components/EmotionCards';
import TemporalChart from './components/TemporalChart';
import CognitiveInsights from './components/CognitiveInsights';
import AIContent from './components/AIContent';
import useMediaRecorder from './hooks/useMediaRecorder';
import useProcessing from './hooks/useProcessing';
import { Brain, RotateCcw } from 'lucide-react';

export default function App() {
  const recorder = useMediaRecorder();
  const processing = useProcessing();
  const [phase, setPhase] = useState('idle'); // 'idle' | 'processing' | 'results'

  const handleAnalyze = async (input, type) => {
    setPhase('processing');

    if (type === 'file') {
      await processing.processFile(input);
    } else {
      await processing.processVideo(input);
    }

    setPhase('results');
  };

  const handleReset = () => {
    processing.reset();
    setPhase('idle');
  };

  return (
    <div className="min-h-screen pb-16">
      <Navbar />

      {/* Spacer for fixed nav */}
      <div className="h-14" />

      {/* Hero title */}
      <header className="text-center pt-10 pb-8 px-4">
        <div className="inline-flex items-center gap-2 mb-3">
          <Brain className="w-5 h-5 text-rajah animate-float" />
          <span className="text-xs font-medium text-rajah/70 uppercase tracking-widest">
            Multimodal Emotion Recognition
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight">
          Discover Your <span className="text-rajah">Emotions</span>
        </h1>
        <p className="mt-2 text-sm text-text-muted max-w-md mx-auto">
          Upload a video or record live — our AI analyzes audio & visual cues to understand your emotional state.
        </p>
      </header>

      <main className="px-4 space-y-6">
        {/* ── Recording / Upload Panel ───────────────────── */}
        {phase === 'idle' && (
          <RecordingPanel
            recorder={recorder}
            onAnalyze={handleAnalyze}
            isProcessing={processing.isProcessing}
          />
        )}

        {/* ── Processing Loader ──────────────────────────── */}
        {phase === 'processing' && processing.isProcessing && (
          <ProcessingLoader
            progress={processing.progress}
            status={processing.status}
          />
        )}

        {/* ── Error ──────────────────────────────────────── */}
        {processing.error && (
          <div className="max-w-2xl mx-auto glass rounded-2xl p-5 border border-red-500/30 text-center space-y-3 animate-fade-up">
            <p className="text-sm text-red-400">{processing.error}</p>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-rajah transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Try again
            </button>
          </div>
        )}

        {/* ── Results ────────────────────────────────────── */}
        {phase === 'results' && processing.results && (
          <div className="space-y-6">
            {/* Cognitive Insights on top */}
            <CognitiveInsights results={processing.results} />

            {/* Emotion Cards */}
            <EmotionCards results={processing.results} />

            {/* Temporal Charts */}
            <TemporalChart results={processing.results} />

            {/* Dotted divider */}
            <div className="max-w-4xl mx-auto border-t border-dotted border-card-border/40" />

            {/* AI Recommendations */}
            <AIContent results={processing.results} />

            {/* Reset button */}
            <div className="flex justify-center pt-4">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl glass border border-rajah/20 text-rajah text-sm font-medium hover:bg-rajah/10 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Analyze Another
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 text-center pb-6">
        <p className="text-xs text-text-muted">
          EmotionAI · Multimodal Emotion Recognition System
        </p>
      </footer>
    </div>
  );
}
