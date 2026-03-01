import React from 'react';
import { motion } from 'framer-motion';

const NarrativeColumn = ({ story, quote }) => {
  return (
    <div className="flex flex-col gap-12 p-16 glass-surface w-full max-w-2xl mx-auto border-t-white/10 pt-16">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase font-bold tracking-[0.5em] text-white/30">Linguistic Synthesis</span>
        <h3 className="text-3xl font-black tracking-tight text-white">Observations</h3>
      </div>

      <div className="space-y-16">
        {/* Narrative Text - Clean Typography Like Claude/Substack on Dark */}
        <p className="text-[20px] leading-[1.8] text-white/80 font-medium font-sans">
          {story || "Statistical synthesis of uploaded sensory streams pending. File ingestion initiates new session."}
        </p>

        {quote && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }} 
            whileInView={{ opacity: 1, x: 0 }}
            className="pl-8 border-l border-white pt-2 pb-2"
          >
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest block mb-6 italic italic tracking-[0.3em]">Core Resonance</span>
            <p className="text-lg text-white/60 font-semibold leading-relaxed">
              &ldquo;{quote}&rdquo;
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer Branding - Subtle Scientific Meta */}
      <div className="flex items-center gap-6 pt-12 border-t border-white/5 opacity-10 text-[9px] font-bold uppercase tracking-[0.4em]">
         <span>Node: AR-V2</span>
         <span>Hash: AE88-00X</span>
         <div className="flex-1 text-right flex items-center justify-end gap-2 text-white">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
            <span>Validated Synthesis</span>
         </div>
      </div>
    </div>
  );
};

export default NarrativeColumn;
