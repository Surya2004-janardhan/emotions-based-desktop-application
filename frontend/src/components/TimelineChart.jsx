import React from 'react';
import { motion } from 'framer-motion';

const TimelineChart = ({ data }) => {
  // data: [{'time': 0, 'emotion': 'joy', 'confidence': 0.8}, ...]
  if (!data?.length) return (
    <div className="w-full h-48 border border-dashed border-white/5 bg-white/[0.01] rounded-3xl flex items-center justify-center">
       <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/10 italic">Temporal analysis pending...</span>
    </div>
  );

  const padding = 40;
  const width = 800;
  const height = 150;
  const xScale = (width - padding * 2) / (data.length - 1);
  const yScale = (val) => height - padding - (val * (height - padding * 2));

  const points = data.map((d, i) => `${i * xScale + padding},${yScale(d.confidence || 0.5)}`).join(' ');

  return (
    <div className="flex flex-col gap-8 w-full glass-surface p-12 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-5">
         <div className="w-40 h-40 border-2 border-dashed border-white rounded-full animate-spin" style={{ animationDuration: '60s' }} />
      </div>

      <div className="flex items-center gap-4 relative z-10">
         <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 italic">Temporal Mapping Log</span>
            <h4 className="text-xl font-black tracking-tight text-white group-hover:tracking-wider transition-all duration-700">Sequence Stability Index</h4>
         </div>
         <div className="flex-1 h-[1px] bg-white/5" />
      </div>

      <div className="relative w-full h-48 py-8 px-4 border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible opacity-60">
           {/* Grid Lines */}
           {[0.2, 0.4, 0.6, 0.8].map((v, i) => (
             <line key={i} x1={padding} y1={yScale(v)} x2={width - padding} y2={yScale(v)} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3" />
           ))}

           {/* Confidence Path */}
           <motion.polyline
             initial={{ pathLength: 0, opacity: 0 }}
             animate={{ pathLength: 1, opacity: 1 }}
             transition={{ duration: 2, ease: "easeOut" }}
             fill="none"
             stroke="white"
             strokeWidth="2"
             points={points}
             className="filter blur-[1px]"
           />

           {/* Data Nodes */}
           {data.map((d, i) => (
             <motion.circle
               key={i}
               initial={{ opacity: 0, r: 0 }}
               animate={{ opacity: 1, r: 2 }}
               transition={{ delay: i * 0.05 }}
               cx={i * xScale + padding}
               cy={yScale(d.confidence || 0.5)}
               fill="white"
             />
           ))}

           {/* X Axis Labels */}
           {data.filter((_, i) => i % 5 === 0).map((d, i) => (
             <text key={i} x={i * 5 * xScale + padding} y={height - 10} textAnchor="middle" className="text-[8px] font-black fill-white/20 uppercase tracking-widest">{d.time}s</text>
           ))}
        </svg>
      </div>

      <div className="flex items-center gap-10 pt-4 opacity-30">
        <div className="flex items-center gap-3">
           <div className="w-2 h-2 rounded-full border border-white" />
           <span className="text-[8px] font-bold uppercase tracking-[0.2em] italic">Micro-State Confidence Score</span>
        </div>
        <div className="flex items-center gap-3">
           <div className="w-10 h-[1.5px] bg-white/40" />
           <span className="text-[8px] font-bold uppercase tracking-[0.2em] italic">Consensus Timeline Mapping</span>
        </div>
      </div>
    </div>
  );
};

export default TimelineChart;
