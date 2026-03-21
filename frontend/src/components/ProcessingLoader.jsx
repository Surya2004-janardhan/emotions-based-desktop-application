import { Loader2, Sparkles } from 'lucide-react';

const STATUS_MAP = {
  'Uploading...': 'Uploading Source...',
  'Initializing': 'Initializing Neural Pipeline...',
  'Extracting Audio': 'Isolating Acoustic Biomarkers...',
  'Processing Video': 'Analyzing Facial Dynamics...',
  'Processing Audio': 'Synthesizing Vocal Patterns...',
  'Cognitive Analysis': 'Running Cognitive Resonance...',
  'Generating AI Response': 'Finalizing Intelligence Layer...',
  'Complete': 'Sequence Complete',
};

export default function ProcessingLoader({ progress, status, previewUrl, recordingMeta }) {
  const displayStatus = STATUS_MAP[status] || status || 'Processing...';

  let sectionLabel = '';
  if (progress <= 10) sectionLabel = 'Acoustic Extraction';
  else if (progress <= 40) sectionLabel = 'Visual Processing';
  else if (progress <= 80) sectionLabel = 'Biometric Synthesis';
  else if (progress <= 90) sectionLabel = 'Cognitive Layer';
  else if (progress < 100) sectionLabel = 'Intelligence Engine';
  else sectionLabel = 'Complete';

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-up mt-12">
      <div className="panel p-8 space-y-8 bg-surface-base">
        {previewUrl && (
          <div className="rounded-xl overflow-hidden border border-border-subtle bg-black">
            <video
              src={previewUrl}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-[240px] object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="px-4 py-2 bg-black/80 text-xs text-white/90 flex items-center justify-between gap-3">
              <span>Captured recording is being processed...</span>
              {recordingMeta?.startedAt && recordingMeta?.endedAt && (
                <span className="font-mono text-[11px]">
                  {new Date(recordingMeta.startedAt).toLocaleTimeString()} - {new Date(recordingMeta.endedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] block">Current Sequence</span>
              <span className="text-sm font-bold text-text-primary uppercase tracking-wider">{displayStatus}</span>
            </div>
          </div>
          <div className="text-right">
             <span className="text-3xl font-black text-primary tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="h-2 rounded-full bg-surface-raised border border-border-subtle overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-dark via-primary to-accent relative transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/10 animate-shimmer" />
            </div>
          </div>

          <div className="flex justify-between mt-6 px-1">
            {[
              { pct: 10, label: 'Isolate' },
              { pct: 40, label: 'Visual' },
              { pct: 60, label: 'Audio' },
              { pct: 85, label: 'Cognitive' },
              { pct: 100, label: 'Finalize' },
            ].map((m) => (
              <div key={m.pct} className="flex flex-col items-center">
                <div
                  className={`w-2 h-2 rounded-full mb-2 transition-all duration-500 ${
                    progress >= m.pct ? 'bg-primary scale-110 shadow-[0_0_8px_rgba(100,153,233,0.5)]' : 'bg-surface-raised border border-border-subtle'
                  }`}
                />
                <span
                  className={`text-[9px] font-bold uppercase tracking-widest transition-colors duration-500 ${
                    progress >= m.pct ? 'text-primary' : 'text-text-muted opacity-50'
                  }`}
                >
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 pt-4 border-t border-border-subtle">
           <Sparkles className="w-3 h-3 text-primary animate-pulse" />
           <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">
             Active Module: <span className="text-text-primary">{sectionLabel}</span>
           </p>
        </div>
      </div>
    </div>
  );
}
