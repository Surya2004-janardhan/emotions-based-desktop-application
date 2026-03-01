import React from 'react';
import { motion } from 'framer-motion';

const EMOTION_COLORS = {
  joy: '#f59e0b',
  surprise: '#06b6d4',
  neutral: '#6b7280',
  disgust: '#10b981',
  fear: '#8b5cf6',
  anger: '#f43f5e',
  sadness: '#3b82f6',
};

const EmotionRadar = ({ emotions }) => {
  const labels = ['Joy', 'Surprise', 'Neutral', 'Disgust', 'Fear', 'Anger', 'Sadness'];
  const size = 300;
  const center = size / 2;
  const radius = size * 0.38;

  const getCoordinates = (index, value) => {
    const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
    const x = center + radius * value * Math.cos(angle);
    const y = center + radius * value * Math.sin(angle);
    return { x, y };
  };

  const points = labels.map((label, i) => {
    const value = emotions ? emotions[label.toLowerCase()] || 0.1 : 0.2;
    return getCoordinates(i, value);
  });

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <div className="flex flex-col gap-8 p-10 glass-panel etched-corners w-full max-w-md mx-auto">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase font-bold tracking-[0.4em] text-cyan-400/50">Spectral Synthesis</span>
        <h3 className="text-2xl font-black tracking-tight gradient-text-cool">Analysis Overview</h3>
      </div>

      <div className="relative w-full aspect-square flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          <defs>
            <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(6, 182, 212, 0.15)" />
              <stop offset="100%" stopColor="rgba(139, 92, 246, 0.15)" />
            </linearGradient>
            <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          {/* Grid rings */}
          {[0.25, 0.5, 0.75, 1].map((scale, i) => (
            <circle key={i} cx={center} cy={center} r={radius * scale} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="2 4" />
          ))}

          {/* Axis lines */}
          {labels.map((_, i) => {
            const p = getCoordinates(i, 1);
            return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />;
          })}

          {/* Gradient Polygon */}
          <motion.path
            initial={{ d: pathData, opacity: 0 }}
            animate={{ d: pathData, opacity: 1 }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
            fill="url(#radarGradient)"
            stroke="url(#radarStroke)"
            strokeWidth="1.5"
          />

          {/* Data Points with emotion colors */}
          {points.map((p, i) => (
            <motion.circle
              key={i}
              initial={{ r: 0 }}
              animate={{ r: 3.5 }}
              transition={{ delay: i * 0.08 }}
              cx={p.x}
              cy={p.y}
              fill={EMOTION_COLORS[labels[i].toLowerCase()]}
              className="drop-shadow-lg"
            />
          ))}

          {/* Labels */}
          {labels.map((label, i) => {
            const p = getCoordinates(i, 1.35);
            return (
              <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
                className="text-[8px] font-bold uppercase tracking-[0.15em]"
                fill={EMOTION_COLORS[label.toLowerCase()]}
                fillOpacity={0.6}
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Emotion Stats */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-6 border-t border-white/5">
        {labels.slice(0, 4).map((label) => (
          <div key={label} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EMOTION_COLORS[label.toLowerCase()] }} />
              <span className="text-[9px] uppercase font-bold text-white/30 tracking-wider">{label}</span>
            </div>
            <span className="text-xl font-black text-white pl-4 border-l-2" style={{ borderColor: EMOTION_COLORS[label.toLowerCase()] + '40' }}>
              {(emotions ? (emotions[label.toLowerCase()] * 100).toFixed(1) : "0.0")}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmotionRadar;
