import React from 'react';
import { motion } from 'framer-motion';

const EmotionRadar = ({ emotions }) => {
  const labels = ['Joy', 'Surprise', 'Neutral', 'Disgust', 'Fear', 'Anger', 'Sadness'];
  const size = 300;
  const center = size / 2;
  const radius = size * 0.4;

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
    <div className="flex flex-col gap-10 p-12 glass-surface w-full max-w-md mx-auto group border-t-white/10 pt-16">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase font-bold tracking-[0.5em] text-white/30">Spectral Synthesis</span>
        <h3 className="text-3xl font-black tracking-tight text-white">Analysis Overview</h3>
      </div>
      
      <div className="relative w-full aspect-square flex items-center justify-center py-6">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible opacity-80">
          {/* Base Grid */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.5" strokeDasharray="3" />
          
          {/* Axis Lines */}
          {labels.map((_, i) => {
            const p = getCoordinates(i, 1);
            return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.5" />;
          })}

          {/* Minimal Polygon - Translucent White */}
          <motion.path
            initial={{ d: pathData }}
            animate={{ d: pathData }}
            transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
            fill="rgba(255, 255, 255, 0.05)"
            stroke="white"
            strokeWidth="1"
            className="filter blur-[1px]"
          />

          {/* Detailed Indicator Dots */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="white" />
          ))}

          {/* Labels - Clean Mono Serif/Sans */}
          {labels.map((label, i) => {
            const p = getCoordinates(i, 1.3);
            return (
              <text key={i} x={p.x} y={p.y} textAnchor="middle" className="text-[9px] font-bold fill-white/20 group-hover:fill-white/60 transition-colors uppercase tracking-[0.2em]">
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-6 pt-10 border-t border-white/5">
        {labels.slice(0, 4).map((label) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-bold text-white/20 tracking-wider font-sans">{label}</span>
            <span className="text-2xl font-black text-white px-2 border-l border-white/10">{(emotions ? (emotions[label.toLowerCase()] * 100).toFixed(1) : "0.0")}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmotionRadar;
