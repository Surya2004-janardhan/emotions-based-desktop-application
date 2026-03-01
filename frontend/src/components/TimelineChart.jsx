import React from 'react';
import { motion } from 'framer-motion';

const TimelineChart = ({ data }) => {
  if (!data?.length) return (
    <div className="w-full h-48 glass-panel flex items-center justify-center">
      <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/15">Temporal analysis pending...</span>
    </div>
  );

  const padding = 40;
  const width = 800;
  const height = 160;
  const xScale = (width - padding * 2) / (data.length - 1);
  const yScale = (val) => height - padding - (val * (height - padding * 2));

  const points = data.map((d, i) => `${i * xScale + padding},${yScale(d.confidence || 0.5)}`).join(' ');

  // Area path for gradient fill under the line
  const areaPath = data.map((d, i) => {
    const x = i * xScale + padding;
    const y = yScale(d.confidence || 0.5);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ') + ` L ${(data.length - 1) * xScale + padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <div className="flex flex-col gap-6 w-full glass-panel p-8 relative overflow-hidden group">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-gradient-to-br from-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="flex items-center gap-3 relative z-10">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400/40">Temporal Mapping</span>
          <h4 className="text-lg font-bold tracking-tight text-white/90 group-hover:tracking-wider transition-all duration-700">Sequence Stability Index</h4>
        </div>
        <div className="flex-1 section-divider" />
      </div>

      <div className="relative w-full h-48 p-4 glass-card overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(6, 182, 212, 0.15)" />
              <stop offset="100%" stopColor="rgba(6, 182, 212, 0)" />
            </linearGradient>
          </defs>

          {/* Grid Lines */}
          {[0.2, 0.4, 0.6, 0.8].map((v, i) => (
            <line key={i} x1={padding} y1={yScale(v)} x2={width - padding} y2={yScale(v)} stroke="rgba(255,255,255,0.03)" strokeDasharray="4 8" />
          ))}

          {/* Area Fill */}
          <motion.path
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
            d={areaPath}
            fill="url(#areaGradient)"
          />

          {/* Gradient Line */}
          <motion.polyline
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Data Nodes */}
          {data.map((d, i) => (
            <motion.circle
              key={i}
              initial={{ opacity: 0, r: 0 }}
              animate={{ opacity: 1, r: 2.5 }}
              transition={{ delay: i * 0.04 }}
              cx={i * xScale + padding}
              cy={yScale(d.confidence || 0.5)}
              fill="#06b6d4"
              className="drop-shadow-lg"
            />
          ))}

          {/* X Axis Labels */}
          {data.filter((_, i) => i % 5 === 0).map((d, i) => (
            <text key={i} x={i * 5 * xScale + padding} y={height - 8} textAnchor="middle" className="text-[8px] font-bold" fill="rgba(255,255,255,0.15)">
              {d.time}s
            </text>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-8 pt-2 opacity-40 text-[8px] font-bold uppercase tracking-[0.15em]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500" />
          <span>Confidence Score</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-[2px] rounded-full" style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)' }} />
          <span>Temporal Flow</span>
        </div>
      </div>
    </div>
  );
};

export default TimelineChart;
