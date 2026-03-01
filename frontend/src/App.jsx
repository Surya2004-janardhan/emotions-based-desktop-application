import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Activity } from "lucide-react";
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
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval;
    if (isProcessing) {
      interval = setInterval(async () => {
        try {
          const response = await fetch("http://localhost:5000/status");
          const data = await response.json();
          setProgress(data.progress);
          if (data.progress >= 100) clearInterval(interval);
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 500);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

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
      setError("SESSION INTERRUPTED. RETRYING...");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen text-white selection:bg-violet-500/30 selection:text-white p-6 lg:p-12 relative font-sans overflow-hidden">

      {/* ── AURORA BACKGROUND ── */}
      <div className="bg-noise" />
      <div className="bg-graticule" />
      <div className="aurora-orb aurora-orb--cyan top-[-15%] left-[-8%] w-[700px] h-[700px]" />
      <div className="aurora-orb aurora-orb--violet bottom-[-15%] right-[-8%] w-[600px] h-[600px]" style={{ animationDelay: '5s' }} />
      <div className="aurora-orb aurora-orb--rose top-[40%] right-[20%] w-[400px] h-[400px]" style={{ animationDelay: '10s' }} />

      {/* ── HEADER ── */}
      <header className="flex flex-col items-center mb-20 max-w-7xl mx-auto pt-10 pb-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/30">Neural Analysis Engine</span>
          </div>

          <h1 className="text-6xl lg:text-7xl font-black tracking-tighter gradient-text">
            EMOTION AI
          </h1>

          <p className="text-sm text-white/30 max-w-md leading-relaxed">
            Upload a video to analyze emotional patterns through facial expression & voice recognition
          </p>
        </motion.div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="max-w-7xl mx-auto space-y-20 relative z-10 pb-32">

        {/* UPLOAD SECTION */}
        <section className="flex flex-col items-center">
          <UploadSection
            onFileSelect={processVideo}
            isProcessing={isProcessing}
          />

          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full max-w-2xl flex flex-col items-center gap-8 mt-12"
              >
                <div className="w-full space-y-3">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-400/60">Analyzing Sequence</span>
                    <span className="text-2xl font-black gradient-text-cool">{progress}%</span>
                  </div>
                  <div className="progress-track">
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      className="progress-fill"
                    />
                    <div className="progress-shimmer" />
                  </div>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 text-rose-400 text-[10px] font-bold uppercase tracking-[0.4em] bg-rose-500/5 px-6 py-3 rounded-full border border-rose-500/15 mt-12 glow-rose">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* DIVIDER */}
        <div className="section-divider" />

        {/* RESULTS */}
        <AnimatePresence>
          {results && !isProcessing && (
            <motion.section
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-24 pb-16"
            >
              <SystemTelemetry results={results} />

              <div className="section-divider" />

              <div className="grid lg:grid-cols-2 gap-20 items-start">
                <div className="space-y-20">
                  <EmotionRadar emotions={results.emotion_distribution} />
                  <div className="section-divider" />
                  <TimelineChart data={results.timeline_data} />
                </div>
                <div className="lg:sticky lg:top-20">
                  <NarrativeColumn story={results.story} quote={results.quote} />
                </div>
              </div>

              <div className="section-divider" />
              <RecommendationGrid songs={results.songs} video={{ title: results.video, link: results.video }} />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* ── FOOTER MARKS ── */}
      <div className="fixed top-16 right-16 text-[8px] font-bold opacity-[0.08] flex flex-col z-50 text-cyan-300">
        <span>NEURAL.v2</span>
        <span>STREAM_OK</span>
      </div>
      <div className="fixed bottom-16 left-16 text-[8px] font-bold opacity-[0.08] flex flex-col z-50 text-violet-300">
        <span>EMOTION_ENGINE</span>
        <span>SESSION_ACTIVE</span>
      </div>
    </div>
  );
}

export default App;