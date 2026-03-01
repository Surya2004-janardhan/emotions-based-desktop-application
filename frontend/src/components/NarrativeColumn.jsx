import React from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

const NarrativeColumn = ({ story, quote }) => {
  return (
    <div className="flex flex-col gap-10 p-10 glass-panel etched-corners w-full max-w-2xl mx-auto">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase font-bold tracking-[0.4em] text-violet-400/50">Linguistic Synthesis</span>
        <h3 className="text-2xl font-black tracking-tight gradient-text">Observations</h3>
      </div>

      <div className="space-y-10">
        {/* Narrative Text */}
        <p className="text-lg leading-[1.9] text-white/70 font-medium">
          {story || "Statistical synthesis of uploaded sensory streams pending. File ingestion initiates new session."}
        </p>

        {quote && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="relative pl-8 py-4"
          >
            {/* Gradient left border */}
            <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full" style={{ background: 'linear-gradient(180deg, #06b6d4, #8b5cf6)' }} />

            <div className="absolute -top-2 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/10 to-violet-500/10 flex items-center justify-center">
              <Quote className="w-3.5 h-3.5 text-cyan-400/60" />
            </div>

            <span className="text-[10px] uppercase font-bold text-violet-400/40 tracking-[0.3em] block mb-4">Core Resonance</span>
            <p className="text-base text-white/50 font-medium leading-relaxed italic">
              &ldquo;{quote}&rdquo;
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 pt-8 border-t border-white/5 text-[8px] font-bold uppercase tracking-[0.3em] text-white/10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/40" />
          <span>Node: AR-V2</span>
        </div>
        <div className="flex-1 h-[0.5px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.1), transparent)' }} />
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
          <span>Validated</span>
        </div>
      </div>
    </div>
  );
};

export default NarrativeColumn;
