import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Shield } from 'lucide-react';

const SystemTelemetry = ({ results }) => {
  if (!results) return null;

  const stats = [
    { label: 'Emotional Stability', value: (results.emotional_stability * 100).toFixed(1) + '%', icon: Activity, color: '#06b6d4', gradient: 'from-cyan-500/15 to-cyan-500/5' },
    { label: 'Analysis Confidence', value: (results.timeline_confidence * 100).toFixed(1) + '%', icon: Shield, color: '#8b5cf6', gradient: 'from-violet-500/15 to-violet-500/5' },
  ];

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/20">System Indicators</span>
        <div className="flex-1 section-divider" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15, duration: 0.5 }}
            className={`glass-panel p-8 flex flex-col gap-4 relative overflow-hidden`}
          >
            {/* Background glow */}
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-br ${stat.gradient} blur-3xl`} />

            <div className="flex items-center gap-3 relative z-10">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.color + '15' }}>
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">{stat.label}</span>
            </div>

            <div className="relative z-10">
              <span className="text-4xl font-black gradient-text-cool">{stat.value}</span>
            </div>

            {/* Mini progress bar */}
            <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden relative z-10">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: stat.value }}
                transition={{ duration: 1, delay: i * 0.2 }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${stat.color}, ${stat.color}80)` }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SystemTelemetry;
