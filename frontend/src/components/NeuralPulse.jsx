import React from "react";
import { motion } from "framer-motion";

const NeuralPulse = ({ isRecording, videoRef }) => {
  return (
    <div className="flex flex-col items-center gap-10 w-full max-w-xl mx-auto py-10">
      <div className="relative w-[320px] h-[320px] flex items-center justify-center">
        {/* Pulsing ring when active */}
        {isRecording && (
          <>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.15, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full"
              style={{ border: '1px solid rgba(6, 182, 212, 0.3)' }}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.05, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute inset-[-20px] rounded-full"
              style={{ border: '1px solid rgba(139, 92, 246, 0.2)' }}
            />
          </>
        )}

        {/* Video viewfinder */}
        <div className="relative w-full h-full rounded-full border border-white/10 bg-black/40 flex items-center justify-center p-3 overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover rounded-full brightness-[0.9] contrast-[1.1]"
          />

          {/* Scanning indicator */}
          {isRecording && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2.5 bg-black/60 backdrop-blur-xl px-5 py-2 rounded-full border border-cyan-500/20 z-20 glow-cyan">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-cyan-300">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Label */}
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20">Optical Sensory Input</span>
        <div className="w-8 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.3), transparent)' }} />
      </div>
    </div>
  );
};

export default NeuralPulse;
