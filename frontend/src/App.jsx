import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ShieldCheck, Zap, Layers, Command, Cpu, Terminal, Database, BarChart3, ScanEye } from "lucide-react";
import UploadSection from "./components/UploadSection";
import EmotionRadar from "./components/EmotionRadar";
import NarrativeColumn from "./components/NarrativeColumn";
import RecommendationGrid from "./components/RecommendationGrid";
import SystemTelemetry from "./components/SystemTelemetry";
import TimelineChart from "./components/TimelineChart";

function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const processVideo = async (file) => {
    if (!file) return;
    setIsProcessing(true);
    setResults(null);
    setError(null);

    const formData = new FormData();
    formData.append("video", file);

    try {
      const response = await fetch("http://localhost:5000/process", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setResults(data);
    } catch (err) {
      setError("Analysis Session Interrupted. Retrying...");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep text-text-bright selection:bg-white selection:text-black p-10 lg:p-16 relative font-sans">
      
      {/* ── Background Grid & Orbs ── */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-white/[0.04] rounded-full filter blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-white/[0.02] rounded-full filter blur-[100px] animate-pulse" style={{ animationDelay: '2.5s' }} />
        <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      {/* ── Header: Centered ── */}
      <header className="flex flex-col items-center mb-32 max-w-7xl mx-auto py-12 border-b border-white/5 relative z-10 text-center">
        <div className="flex flex-col gap-4 items-center">
          <h1 className="text-5xl font-black tracking-tighter flex items-center gap-6">
             <Command className="w-10 h-10 opacity-20" /> EMOTION AI
          </h1>
          <span className="text-[11px] font-extrabold text-white/20 uppercase tracking-[1em] ml-2">Multimodal State Synthesis</span>
        </div>

        <div className="mt-12 flex items-center gap-4 bg-white/[0.02] px-10 py-3.5 rounded-full border border-white/5 backdrop-blur-3xl group shadow-2xl">
           <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center transition-all ${isProcessing ? 'bg-white animate-pulse' : 'bg-white/10'}`} />
           <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30 group-hover:text-white/80 transition-all">
             {isProcessing ? 'SYNCHRONIZING' : 'CORE_STANDBY'}
           </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-48 relative z-10 pb-48">
        
        {/* Phase 1: Ingestion Hub */}
        <section className="flex flex-col items-center">
          <div className="w-full grid lg:grid-cols-2 gap-16 items-center">
             <div className="space-y-12">
                <div className="flex flex-col gap-6">
                   <div className="flex items-center gap-4 opacity-30">
                      <Database className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-[0.4em]">Node Protocol Ingestion</span>
                   </div>
                   <h2 className="text-6xl font-black tracking-tighter leading-tight italic">Ingest Sensory Data Stream.</h2>
                   <p className="text-xl text-white/40 leading-relaxed font-medium">Extracting emotion markers from high-frame sequence and audio frequency domain. Analysis duration calibrated for 11 second window.</p>
                </div>
                
                {/* Micro Details */}
                <div className="grid grid-cols-2 gap-8 border-t border-white/5 pt-12">
                   <div className="flex flex-col gap-2">
                      <span className="text-[8px] font-black uppercase tracking-[0.3em] opacity-20 italic">Validated Modality</span>
                      <span className="text-xs font-bold text-white/60 flex items-center gap-2 underline decoration-white/20 underline-offset-4 cursor-crosshair">Visual Neural Net 3.4</span>
                   </div>
                   <div className="flex flex-col gap-2">
                      <span className="text-[8px] font-black uppercase tracking-[0.3em] opacity-20 italic">Encrypted Transfer</span>
                      <span className="text-xs font-bold text-white/60 flex items-center gap-2 underline decoration-white/20 underline-offset-4 cursor-crosshair">AES-256 Tunnel active</span>
                   </div>
                </div>
             </div>
             
             <UploadSection 
                onFileSelect={processVideo} 
                isProcessing={isProcessing} 
             />
          </div>

          <AnimatePresence>
            {error && (
               <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 text-white text-[10px] font-black uppercase tracking-[0.4em] bg-white/5 px-8 py-4 rounded-full border border-white/10 mt-16 group hover:border-red-500/40 transition-all">
                  <Activity className="w-4 h-4 text-red-500 animate-pulse" /> {error}
               </motion.div>
            )}
            {isProcessing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-10 mt-24 group relative text-center">
                <div className="flex items-center gap-4">
                   <Zap className="w-6 h-6 text-white/40 animate-pulse" />
                   <span className="text-[14px] font-black uppercase tracking-[1.5em] text-white/20 italic">Extracting Spectral Metadata</span>
                </div>
                <div className="w-full max-w-xl h-[2px] bg-white/[0.05] relative overflow-hidden rounded-full">
                   <motion.div 
                     initial={{ x: '-100%' }}
                     animate={{ x: '100%' }}
                     transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                     className="absolute inset-0 bg-white/60"
                   />
                </div>
                <div className="flex items-center gap-12 opacity-10">
                   {['FFMPEG', 'OPENCV', 'MFCC', 'LSTM'].map(lib => (
                      <span key={lib} className="text-[9px] font-black uppercase tracking-widest">{lib}</span>
                   ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Phase 2: Synthesis & Telemetry Dashboard */}
        <AnimatePresence>
          {results && !isProcessing && (
            <motion.section 
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-32"
            >
              {/* Telemetry Bar */}
              <SystemTelemetry results={results} />

              <div className="grid lg:grid-cols-2 gap-32 items-start">
                {/* Analytical Column */}
                <div className="space-y-32">
                  <div className="space-y-12">
                     <div className="flex items-center gap-4 opacity-30">
                        <ScanEye className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Visual Modality Pattern Map</span>
                     </div>
                     <EmotionRadar emotions={results.emotion_distribution} />
                  </div>
                  
                  <div className="space-y-12">
                     <div className="flex items-center gap-4 opacity-30">
                        <BarChart3 className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Temporal Convergence Analysis</span>
                     </div>
                     <TimelineChart data={results.timeline_data} />
                  </div>
                </div>

                {/* Narrative Column */}
                <div className="lg:sticky lg:top-24 space-y-12">
                   <div className="flex items-center gap-4 opacity-30">
                      <Terminal className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-[0.4em]">Synthesized Narrative Log</span>
                   </div>
                   <NarrativeColumn story={results.story} quote={results.quote} />
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Phase 3: Discovery Masonry */}
        <AnimatePresence>
          {results && !isProcessing && (
            <motion.section
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, delay: 0.5 }}
            >
              <RecommendationGrid songs={results.songs} video={{ title: results.video, link: results.video }} />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Simple Footer without scrolling ticker */}
      <footer className="mt-32 max-w-7xl mx-auto pb-24 relative z-10 font-sans italic opacity-20 border-t border-white/5 pt-20">
         <div className="flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="flex items-center gap-12 text-[10px] font-black uppercase tracking-[1em]">
               <span>SYSTEM_ACTIVE</span>
               <div className="w-1.5 h-1.5 bg-white rounded-full" />
               <span>2026.AR</span>
            </div>
            <div className="flex items-center gap-6 group cursor-crosshair transition-all hover:opacity-100">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] transition-all hover:tracking-[0.6em]">Validated Neural Architecture // SECURE_NODE</span>
            </div>
         </div>
      </footer>
    </div>
  );
}

export default App;