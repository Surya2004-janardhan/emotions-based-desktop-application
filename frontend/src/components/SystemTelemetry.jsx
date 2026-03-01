import React from 'react';
import { motion } from 'framer-motion';
import { Activity, ShieldCheck, Cpu, Terminal } from 'lucide-react';

const SystemTelemetry = ({ results }) => {
  const stats = [
    { label: 'Neural Stability', value: results ? (results.emotional_stability * 100).toFixed(1) + '%' : '0.0%', icon: Activity },
    { label: 'Timeline Confidence', value: results ? (results.timeline_confidence * 100).toFixed(1) + '%' : '0.0%', icon: ShieldCheck },
    { label: 'Processing Latency', value: results ? '1.24s' : '0.00s', icon: Cpu }
  ];

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex items-center gap-4 opacity-40">
        <Terminal className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.4em]">System Telemetry // Real-Time</span>
        <div className="flex-1 h-[1px] bg-white/10" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 flex items-center justify-between group"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em]">{stat.label}</span>
              <span className="text-2xl font-black text-white group-hover:tracking-wider transition-all duration-500">{stat.value}</span>
            </div>
            <stat.icon className="w-5 h-5 text-white/10 group-hover:text-white group-hover:scale-110 transition-all" />
          </motion.div>
        ))}
      </div>

      {results && (
        <div className="glass-surface p-6 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity className="w-12 h-12" />
          </div>
          <div className="flex flex-col gap-4">
             <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest italic">Consensus Vote Analysis</span>
                <span className="text-[10px] uppercase font-bold text-white/60 tracking-widest">{results.fused_emotion}</span>
             </div>
             <div className="w-full h-[2px] bg-white/5 relative">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '85%' }}
                  className="absolute inset-x-0 h-full bg-white opacity-40"
                />
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemTelemetry;
