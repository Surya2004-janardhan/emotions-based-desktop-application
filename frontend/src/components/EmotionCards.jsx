import { Mic, MonitorPlay, Zap } from 'lucide-react';

const EMOTION_CONFIG = {
  happy:     { color: '#22C55E', emoji: '😊' },
  sad:       { color: '#3B82F6', emoji: '😢' },
  angry:     { color: '#EF4444', emoji: '😠' },
  fearful:   { color: '#A855F7', emoji: '😨' },
  neutral:   { color: '#94a3b8', emoji: '😐' },
  surprised: { color: '#F59E0B', emoji: '😲' },
  disgust:   { color: '#84CC16', emoji: '🤢' },
};

function Card({ icon: Icon, label, emotion, sublabel, delay }) {
  const cfg = EMOTION_CONFIG[emotion] || EMOTION_CONFIG.neutral;

  return (
    <div
      className="glass glow-border rounded-2xl p-5 flex flex-col items-center gap-3 animate-fade-up hover:scale-[1.03] transition-transform duration-300"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center gap-2 text-text-muted text-xs font-medium uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <span className="text-4xl">{cfg.emoji}</span>
      <p className="text-lg font-semibold capitalize" style={{ color: cfg.color }}>
        {emotion}
      </p>
      {sublabel && (
        <span className="text-[11px] text-text-muted">{sublabel}</span>
      )}
      {/* Color dot accent */}
      <div
        className="w-8 h-1 rounded-full mt-1"
        style={{ backgroundColor: cfg.color, opacity: 0.5 }}
      />
    </div>
  );
}

export default function EmotionCards({ results }) {
  if (!results) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto stagger">
      <Card
        icon={Mic}
        label="Audio"
        emotion={results.audio_emotion || 'neutral'}
        sublabel="Voice analysis"
        delay={0.05}
      />
      <Card
        icon={MonitorPlay}
        label="Video"
        emotion={results.video_emotion || 'neutral'}
        sublabel="Facial expression"
        delay={0.12}
      />
      <Card
        icon={Zap}
        label="Fused"
        emotion={results.fused_emotion || 'neutral'}
        sublabel="Combined result"
        delay={0.19}
      />
    </div>
  );
}
