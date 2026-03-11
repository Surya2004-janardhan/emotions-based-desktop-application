import { BrainCircuit, Activity, TrendingDown, ArrowRight, Zap, Waves, Eye, Gauge, HeartPulse, Shield, BarChart3, Info } from 'lucide-react';

const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgust', 'surprised'];
const EMOTION_EMOJI = {
  happy: '😊', sad: '😢', angry: '😠', fearful: '😨',
  neutral: '😐', surprised: '😲', disgust: '🤢',
};

// Valence mapping: negative to positive (-1 to +1)
const VALENCE = { happy: 0.9, surprised: 0.4, neutral: 0.0, sad: -0.6, fearful: -0.5, disgust: -0.7, angry: -0.8 };
// Arousal mapping: calm to excited (0 to 1)
const AROUSAL = { neutral: 0.1, sad: 0.2, disgust: 0.4, happy: 0.6, fearful: 0.7, surprised: 0.8, angry: 0.9 };

function ProgressGauge({ value, label, icon: Icon, max = 1, color }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-surface-raised shrink-0 border border-border-subtle">
        <Icon className="w-5 h-5" style={{ color: color || 'var(--color-primary)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[11px] text-text-secondary font-bold uppercase tracking-wider">{label}</span>
          <span className="text-xs font-bold tabular-nums text-text-primary">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-base border border-border-subtle overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-1000 ease-out" 
            style={{ 
              width: `${pct}%`, 
              background: `linear-gradient(90deg, var(--color-primary-dark), ${color || 'var(--color-primary)'})` 
            }} 
          />
        </div>
      </div>
    </div>
  );
}

function computeAdvancedMetrics(results) {
  const audioTemporal = results.audio_temporal || [];
  const videoTemporal = results.video_temporal || [];
  const temporal = videoTemporal.length > 0 ? videoTemporal : audioTemporal;
  if (temporal.length < 2) return null;

  const metrics = {};

  // ── 1. Valence Trajectory ────────────────────────────
  const valenceArr = temporal.map(e => VALENCE[e] ?? 0);
  const avgValence = valenceArr.reduce((s, v) => s + v, 0) / valenceArr.length;
  const valenceStart = valenceArr.slice(0, Math.ceil(valenceArr.length / 3)).reduce((s, v) => s + v, 0) / Math.ceil(valenceArr.length / 3);
  const valenceEnd = valenceArr.slice(-Math.ceil(valenceArr.length / 3)).reduce((s, v) => s + v, 0) / Math.ceil(valenceArr.length / 3);
  const valenceShift = valenceEnd - valenceStart;

  if (valenceShift > 0.2) metrics.valenceTrajectory = { direction: 'Ascending', desc: 'Positive emotional transition detected — valence levels increased significantly.', score: Math.min(1, (valenceEnd + 1) / 2) };
  else if (valenceShift < -0.2) metrics.valenceTrajectory = { direction: 'Descending', desc: 'Negative emotional drift noted — valence levels softened toward the end.', score: Math.max(0, (valenceEnd + 1) / 2) };
  else metrics.valenceTrajectory = { direction: 'Stable', desc: `Valence baseline remained ${avgValence > 0.2 ? 'optimistic' : avgValence < -0.2 ? 'attenuated' : 'balanced'} throughout.`, score: (avgValence + 1) / 2 };

  // ── 2. Arousal Arc ───────────────────────────────────
  const arousalArr = temporal.map(e => AROUSAL[e] ?? 0.3);
  const avgArousal = arousalArr.reduce((s, v) => s + v, 0) / arousalArr.length;
  const peakArousal = Math.max(...arousalArr);
  const peakIdx = arousalArr.indexOf(peakArousal);
  const peakPosition = peakIdx < temporal.length * 0.33 ? 'initial phase' : peakIdx > temporal.length * 0.66 ? 'final phase' : 'mid-session';
  metrics.arousal = { avg: avgArousal, peak: peakArousal, peakAt: peakPosition, emotion: temporal[peakIdx] };

  // ── 3. Audio-Visual Coherence ────────────────────────
  if (audioTemporal.length > 0 && videoTemporal.length > 0) {
    const minLen = Math.min(audioTemporal.length, videoTemporal.length);
    let matches = 0;
    for (let i = 0; i < minLen; i++) {
      if (audioTemporal[i] === videoTemporal[i]) matches++;
    }
    const coherence = matches / minLen;
    metrics.avCoherence = {
      score: coherence,
      desc: coherence > 0.7 ? 'Strong multimodal synchronization — high expressive transparency.'
           : coherence > 0.4 ? 'Moderate modality variance — presence of complex, layered emotional states.'
           : 'Significant modality divergence — potential internal emotional processing detected.'
    };
  }

  // ── 4. Emotional Regulation Index ────────────────────
  let recoverySum = 0, recoveryCount = 0;
  for (let i = 1; i < arousalArr.length; i++) {
    if (arousalArr[i - 1] > 0.6 && arousalArr[i] < arousalArr[i - 1]) {
      recoverySum += (arousalArr[i - 1] - arousalArr[i]);
      recoveryCount++;
    }
  }
  const regulationScore = recoveryCount > 0 ? Math.min(1, recoverySum / recoveryCount / 0.5) : (avgArousal < 0.4 ? 0.9 : 0.5);
  metrics.regulation = { score: regulationScore };

  // ── 5. Micro-expression Patterns ─────────────────────
  let rapidShifts = 0;
  for (let i = 2; i < temporal.length; i++) {
    if (temporal[i] === temporal[i - 2] && temporal[i] !== temporal[i - 1]) {
      rapidShifts++;
    }
  }
  metrics.microExpressions = { count: rapidShifts };

  // ── 6. Emotional Journey Insights ────────────────────
  const mid = Math.floor(temporal.length / 2);
  const count = (arr) => { const c = {}; arr.forEach(e => c[e] = (c[e] || 0) + 1); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
  const firstDom = count(temporal.slice(0, mid))[0];
  const secondDom = count(temporal.slice(mid))[0];
  
  const transitions = [];
  for (let i = 1; i < temporal.length; i++) {
    if (temporal[i] !== temporal[i - 1]) transitions.push({ from: temporal[i - 1], to: temporal[i], at: i });
  }

  metrics.journey = { firstDom, secondDom, transitions, uniqueEmotions: new Set(temporal).size };

  return metrics;
}

export default function CognitiveInsights({ results }) {
  if (!results) return null;
  const m = computeAdvancedMetrics(results);

  return (
    <div className="max-w-2xl mx-auto panel p-6 space-y-8 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BrainCircuit className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">
            Cognitive Diagnostics
          </h3>
        </div>
        <div className="px-2 py-0.5 rounded bg-surface-raised border border-border-subtle text-[9px] font-bold text-text-muted uppercase tracking-tighter">
          Multimodal V4.2
        </div>
      </div>

      {/* Core Gauges */}
      <div className="grid grid-cols-1 gap-6">
        <ProgressGauge value={results.timeline_confidence ?? 0} label="Diagnostic Confidence" icon={Activity} color="var(--color-primary)" />
        <ProgressGauge value={results.emotional_stability ?? 0} label="Emotional Equilibrium" icon={HeartPulse} color="#22C55E" />
        <ProgressGauge value={1 - (results.transition_rate ?? 0)} label="Signal Harmonicity" icon={Shield} color="#A855F7" />
      </div>

      {m && (
        <div className="space-y-6 pt-6 border-t border-border-subtle">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            {/* Valence Trajectory */}
            {m.valenceTrajectory && (
              <div className="flex items-start gap-3">
                <Waves className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Emotional Stability</span>
                  <p className="text-xs font-semibold text-text-primary mt-1 mb-0.5">{m.valenceTrajectory.direction}</p>
                  <p className="text-[10px] text-text-secondary leading-normal">{m.valenceTrajectory.desc}</p>
                </div>
              </div>
            )}

            {/* Arousal Arc */}
            {m.arousal && (
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Intensity Peak</span>
                  <p className="text-xs font-semibold text-text-primary mt-1 mb-0.5">{Math.round(m.arousal.peak * 100)}% Momentum</p>
                  <p className="text-[10px] text-text-secondary leading-normal">
                    Maximum arousal detected in {m.arousal.peakAt} as {m.arousal.emotion} {EMOTION_EMOJI[m.arousal.emotion]}.
                  </p>
                </div>
              </div>
            )}

            {/* AV Coherence */}
            {m.avCoherence && (
              <div className="flex items-start gap-3">
                <Eye className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Signal Coherence</span>
                  <p className="text-xs font-semibold text-text-primary mt-1 mb-0.5">{Math.round(m.avCoherence.score * 100)}% Matched</p>
                  <p className="text-[10px] text-text-secondary leading-normal">{m.avCoherence.desc}</p>
                </div>
              </div>
            )}

            {/* Emotional Regulation */}
            {m.regulation && (
              <div className="flex items-start gap-3">
                <Gauge className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Homeostasis</span>
                  <p className="text-xs font-semibold text-text-primary mt-1 mb-0.5">{Math.round(m.regulation.score * 100)}% Regulation</p>
                  <p className="text-[10px] text-text-secondary leading-normal">
                    Index of emotional recovery following high-arousal stimulus variants.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Emotional Journey + Micro-expressions */}
          <div className="p-4 rounded-lg bg-surface-base border border-border-subtle space-y-4">
            {/* Journey arc */}
            {m.journey.firstDom && m.journey.secondDom && (
              <div className="flex items-start gap-3">
                <ArrowRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  <span className="text-text-primary font-bold mr-1">Temporal Mapping:</span>
                  {m.journey.firstDom[0] !== m.journey.secondDom[0]
                    ? `Transition from ${m.journey.firstDom[0]} ${EMOTION_EMOJI[m.journey.firstDom[0]]} to ${m.journey.secondDom[0]} ${EMOTION_EMOJI[m.journey.secondDom[0]]} over ${m.journey.transitions.length} shifts.`
                    : `Persistent ${m.journey.firstDom[0]} ${EMOTION_EMOJI[m.journey.firstDom[0]]} state with minor variance across ${m.journey.uniqueEmotions} emotion types.`}
                </p>
              </div>
            )}

            {/* Micro-expressions */}
            {m.microExpressions.count > 0 && (
              <div className="flex items-start gap-3">
                <BarChart3 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  <span className="text-text-primary font-bold mr-1">Micro-Expressions:</span>
                  Detected {m.microExpressions.count} high-frequency temporal shifts. These represent subconscious emotional leakage beyond focal states.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reasoning */}
      {results.reasoning && (
        <div className="pt-6 border-t border-border-subtle">
           <div className="flex items-start gap-2 mb-2">
             <Info className="w-3 h-3 text-text-muted mt-0.5" />
             <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Analysis Reasoning</span>
           </div>
           <p className="text-xs text-text-muted leading-relaxed italic">
            "{results.reasoning}"
          </p>
        </div>
      )}
    </div>
  );
}
