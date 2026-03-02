import { BrainCircuit, Activity, TrendingDown } from 'lucide-react';

function Gauge({ value, label, icon: Icon, max = 1 }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-rajah shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-text-secondary font-medium">{label}</span>
          <span className="text-xs text-rajah font-semibold tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-bluewood-dark overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rajah-dark to-rajah transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function CognitiveInsights({ results }) {
  if (!results) return null;

  return (
    <div className="max-w-2xl mx-auto glass glow-border rounded-2xl p-6 space-y-5 animate-fade-up" style={{ animationDelay: '0.15s' }}>
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <BrainCircuit className="w-4 h-4 text-rajah" />
        Cognitive Insights
      </h3>

      {/* Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Gauge
          value={results.timeline_confidence ?? 0}
          label="Confidence"
          icon={Activity}
        />
        <Gauge
          value={results.emotional_stability ?? 0}
          label="Stability"
          icon={BrainCircuit}
        />
        <Gauge
          value={1 - (results.transition_rate ?? 0)}
          label="Consistency"
          icon={TrendingDown}
        />
      </div>

      {/* Reasoning text */}
      {results.reasoning && (
        <p className="text-xs text-text-secondary leading-relaxed border-t border-card-border/40 pt-4">
          {results.reasoning}
        </p>
      )}
    </div>
  );
}
