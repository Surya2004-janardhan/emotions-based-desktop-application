import { BrainCircuit, Activity, TrendingDown, ArrowRight, Zap, Waves, Eye, Gauge, HeartPulse, Shield } from 'lucide-react';

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
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 shrink-0" style={{ color: color || '#D5CF2F' }} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-text-secondary font-medium">{label}</span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: color || '#D5CF2F' }}>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-cherry-dark overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color || '#b5b020'}, ${color || '#D5CF2F'})` }} />
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

  if (valenceShift > 0.2) metrics.valenceTrajectory = { direction: 'Getting Better', desc: 'Your mood improved over time — you started feeling more positive as the session went on', score: Math.min(1, (valenceEnd + 1) / 2) };
  else if (valenceShift < -0.2) metrics.valenceTrajectory = { direction: 'Dipping Down', desc: 'Your mood dropped a bit — you seemed to feel less positive toward the end', score: Math.max(0, (valenceEnd + 1) / 2) };
  else metrics.valenceTrajectory = { direction: 'Steady', desc: `Your mood stayed ${avgValence > 0.2 ? 'mostly positive' : avgValence < -0.2 ? 'on the lower side' : 'pretty even'} throughout`, score: (avgValence + 1) / 2 };

  // ── 2. Arousal Arc ───────────────────────────────────
  const arousalArr = temporal.map(e => AROUSAL[e] ?? 0.3);
  const avgArousal = arousalArr.reduce((s, v) => s + v, 0) / arousalArr.length;
  const peakArousal = Math.max(...arousalArr);
  const peakIdx = arousalArr.indexOf(peakArousal);
  const peakPosition = peakIdx < temporal.length * 0.33 ? 'early' : peakIdx > temporal.length * 0.66 ? 'late' : 'mid-session';
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
      desc: coherence > 0.7 ? 'Your voice and face matched well — you were expressing your feelings openly'
           : coherence > 0.4 ? 'Your voice and face told slightly different stories — you might have been feeling mixed emotions'
           : 'Your voice said one thing, but your face said another — you may have been holding back how you really feel'
    };
  }

  // ── 4. Emotional Regulation Index ────────────────────
  // How quickly do high-arousal states return to baseline?
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
      rapidShifts++; // A→B→A pattern = micro-expression
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
    <div className="max-w-2xl mx-auto glass glow-border rounded-2xl p-6 space-y-5 animate-fade-up" style={{ animationDelay: '0.15s' }}>
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <BrainCircuit className="w-4 h-4 text-wattle" />
        How You're Feeling — Deep Insights
        <span className="text-[9px] text-text-muted font-normal ml-auto">AI Analysis</span>
      </h3>

      {/* Core Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ProgressGauge value={results.timeline_confidence ?? 0} label="How Sure We Are" icon={Activity} color="#D5CF2F" />
        <ProgressGauge value={results.emotional_stability ?? 0} label="Emotional Steadiness" icon={HeartPulse} color="#22C55E" />
        <ProgressGauge value={1 - (results.transition_rate ?? 0)} label="Signal Clarity" icon={Shield} color="#3B82F6" />
      </div>

      {m && (
        <>
          {/* Dotted separator */}
          <div style={{ borderTop: '1px dotted rgba(213,207,47,0.12)' }} />

          {/* Advanced Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Valence Trajectory */}
            {m.valenceTrajectory && (
              <div className="flex items-start gap-2.5">
                <Waves className="w-3.5 h-3.5 text-wattle mt-0.5 shrink-0" />
                <div>
                  <span className="text-[11px] text-wattle font-semibold">Mood Trend: {m.valenceTrajectory.direction}</span>
                  <p className="text-[10px] text-text-secondary leading-relaxed mt-0.5">{m.valenceTrajectory.desc}</p>
                </div>
              </div>
            )}

            {/* Arousal Arc */}
            {m.arousal && (
              <div className="flex items-start gap-2.5">
                <Zap className="w-3.5 h-3.5 text-wattle mt-0.5 shrink-0" />
                <div>
                  <span className="text-[11px] text-wattle font-semibold">Energy Level: peaked {m.arousal.peakAt}</span>
                  <p className="text-[10px] text-text-secondary leading-relaxed mt-0.5">
                    Your strongest moment ({Math.round(m.arousal.peak * 100)}% intensity) was {m.arousal.peakAt} when you felt {m.arousal.emotion} {EMOTION_EMOJI[m.arousal.emotion] || ''}. Overall energy: {Math.round(m.arousal.avg * 100)}%.
                  </p>
                </div>
              </div>
            )}

            {/* AV Coherence */}
            {m.avCoherence && (
              <div className="flex items-start gap-2.5">
                <Eye className="w-3.5 h-3.5 text-wattle mt-0.5 shrink-0" />
                <div>
                  <span className="text-[11px] text-wattle font-semibold">Voice-Face Match: {Math.round(m.avCoherence.score * 100)}%</span>
                  <p className="text-[10px] text-text-secondary leading-relaxed mt-0.5">{m.avCoherence.desc}</p>
                </div>
              </div>
            )}

            {/* Emotional Regulation */}
            {m.regulation && (
              <div className="flex items-start gap-2.5">
                <Gauge className="w-3.5 h-3.5 text-wattle mt-0.5 shrink-0" />
                <div>
                  <span className="text-[11px] text-wattle font-semibold">Self-Control: {Math.round(m.regulation.score * 100)}%</span>
                  <p className="text-[10px] text-text-secondary leading-relaxed mt-0.5">
                    {m.regulation.score > 0.7 ? 'You bounce back quickly after emotional highs — good self-control' 
                     : m.regulation.score > 0.4 ? 'You take a bit of time to settle down after strong emotions'
                     : 'Strong emotions stayed with you for a while — you were really feeling things deeply'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Emotional Journey + Micro-expressions */}
          <div style={{ borderTop: '1px dotted rgba(213,207,47,0.08)' }} />
          <div className="space-y-2.5">
            {/* Journey arc */}
            {m.journey.firstDom && m.journey.secondDom && (
              <div className="flex items-start gap-2.5">
                <ArrowRight className="w-3.5 h-3.5 text-wattle mt-0.5 shrink-0" />
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  <span className="text-wattle font-semibold">Your Journey:</span>{' '}
                  {m.journey.firstDom[0] !== m.journey.secondDom[0]
                    ? `You started out ${m.journey.firstDom[0]} ${EMOTION_EMOJI[m.journey.firstDom[0]] || ''} and ended up ${m.journey.secondDom[0]} ${EMOTION_EMOJI[m.journey.secondDom[0]] || ''} — your feelings shifted ${m.journey.transitions.length} time${m.journey.transitions.length !== 1 ? 's' : ''} through ${m.journey.uniqueEmotions} different emotions`
                    : `You stayed mostly ${m.journey.firstDom[0]} ${EMOTION_EMOJI[m.journey.firstDom[0]] || ''} the whole time — we picked up ${m.journey.uniqueEmotions} different emotion${m.journey.uniqueEmotions !== 1 ? 's' : ''} in total`}
                </p>
              </div>
            )}

            {/* Micro-expressions */}
            {m.microExpressions.count > 0 && (
              <div className="flex items-start gap-2.5">
                <BrainCircuit className="w-3.5 h-3.5 text-wattle mt-0.5 shrink-0" />
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  <span className="text-wattle font-semibold">Quick Flickers:</span>{' '}
                  We caught {m.microExpressions.count} tiny flash{m.microExpressions.count > 1 ? 'es' : ''} where a different emotion popped up for just a split second before going back — these are quick, real feelings that most systems can't catch.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Reasoning */}
      {results.reasoning && (
        <p className="text-[10px] text-text-muted leading-relaxed pt-3 italic" style={{ borderTop: '1px solid rgba(213,207,47,0.06)' }}>
          {results.reasoning}
        </p>
      )}
    </div>
  );
}
