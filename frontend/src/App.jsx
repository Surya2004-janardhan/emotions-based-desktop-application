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
import { Brain, RotateCcw, Info, AlertTriangle, Sparkles } from 'lucide-react';

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
      <header className="text-center pt-16 pb-12 px-4 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">
            Multimodal Intelligence
          </span>
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-black text-text-primary tracking-tight leading-tight mb-6">
          Decode the Human <span className="text-primary">Experience.</span>
        </h1>
        
        <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
          Our neural engine synthesizes audio and visual biomarkers to provide 
           cognitive resonance and emotional insights in real-time.
        </p>

        {/* Project Context */}
        <div className="mt-8 p-4 rounded-xl bg-surface-base border border-border-subtle max-w-2xl mx-auto">
          <p className="text-[11px] text-text-muted leading-relaxed font-medium">
            <span className="text-text-primary font-bold mr-1">Core Objective:</span> 
            Bridging the gap between human affect and machine perception. 
            Engineered for clinical therapy, talent acquisition, and advanced sentiment synthesis.
          </p>
        </div>
      </header>

      <main className="px-4 space-y-12">
        {phase === 'idle' && (
          <RecordingPanel recorder={recorder} onAnalyze={handleAnalyze} isProcessing={processing.isProcessing} />
        )}

        {phase === 'processing' && processing.isProcessing && (
          <ProcessingLoader progress={processing.progress} status={processing.status} />
        )}

        {processing.error && (
          <div className="max-w-2xl mx-auto panel p-8 text-center space-y-4 animate-fade-up border-red-500/30">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-sm font-medium text-red-400">{processing.error}</p>
            <button 
              onClick={handleReset} 
              className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-surface-raised text-sm font-bold text-text-primary hover:bg-surface-raised/80 transition-all cursor-pointer border border-border-subtle"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Engine
            </button>
          </div>
        )}

        {phase === 'results' && processing.results && (
          <div className="space-y-12 stagger">
            <CognitiveInsights results={processing.results} />
            <EmotionCards results={processing.results} />
            <TemporalChart results={processing.results} />
            
            <div className="max-w-4xl mx-auto border-t border-border-subtle pt-12">
               <AIContent results={processing.results} />
            </div>

            <div className="flex justify-center pt-8">
              <button
                onClick={handleReset}
                className="group flex items-center gap-3 px-10 py-4 rounded-xl bg-surface-raised text-text-primary text-sm font-bold uppercase tracking-widest border border-border-subtle transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                Initialize New Scan
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Chatbot overlay */}
      <Chatbot key={chatKey} results={processing.results} isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      <footer className="mt-24 text-center pb-12 border-t border-border-subtle pt-12">
        <div className="flex items-center justify-center gap-2 mb-2 opacity-50">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest">EmotionAI System</span>
        </div>
        
      </footer>
    </div>
  );
}
