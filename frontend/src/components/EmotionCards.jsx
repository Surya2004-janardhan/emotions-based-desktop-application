import { Mic, MonitorPlay, Zap } from 'lucide-react';

const EMOTION_CONFIG = {
  neutral:   { color: '#94A3B8', emoji: '😐' },
  happy:     { color: '#22C55E', emoji: '😊' },
  sad:       { color: '#6499E9', emoji: '😢' },
  angry:     { color: '#F43F5E', emoji: '😠' },
  fearful:   { color: '#A855F7', emoji: '😨' },
  disgust:   { color: '#84CC16', emoji: '🤢' },
  surprised: { color: '#FB923C', emoji: '😲' },
};

function Card({ icon, label, emotion, sublabel }) {
  const cfg = EMOTION_CONFIG[emotion] || EMOTION_CONFIG.neutral;

  return (
    <div className="panel p-6 flex flex-col items-center text-center gap-4 transition-all hover:border-primary/30 group">
      <div className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-1">
        {icon}
        {label}
      </div>
      
      <div className="relative">
         <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
         <span className="text-5xl relative z-10">{cfg.emoji}</span>
      </div>

      <div className="space-y-1">
        <p className="text-xl font-black tracking-tight capitalize" style={{ color: cfg.color }}>
          {emotion}
        </p>
        {sublabel && (
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{sublabel}</p>
        )}
      </div>

      <div
        className="w-10 h-1 rounded-full mt-2"
        style={{ backgroundColor: cfg.color, opacity: 0.3 }}
      />
    </div>
  );
}

export default function EmotionCards({ results }) {
  if (!results) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
      <Card icon={<Mic className="w-3.5 h-3.5 text-primary/60 group-hover:text-primary transition-colors" />} label="Acoustic" emotion={results.audio_emotion || 'neutral'} sublabel="Voice Modulation" />
      <Card icon={<MonitorPlay className="w-3.5 h-3.5 text-primary/60 group-hover:text-primary transition-colors" />} label="Visual" emotion={results.video_emotion || 'neutral'} sublabel="Facial Dynamics" />
      <Card icon={<Zap className="w-3.5 h-3.5 text-primary/60 group-hover:text-primary transition-colors" />} label="Stress Signal" emotion={results.fused_emotion || 'neutral'} sublabel={results.stress_label ? `${results.stress_label} load` : 'Current pattern'} />
    </div>
  );
}
