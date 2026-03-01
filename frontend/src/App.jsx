import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Video,
  Play,
  Pause,
  Loader2,
  Brain,
  BookOpen,
  Youtube,
  Sparkles,
  Zap,
  Activity,
  X,
  Mic,
  ArrowRight,
  Headphones,
  CheckCircle2,
  Waves,
  ScanText,
  ScanEye,
  Volume2,
  Circle,
  Dot,
  BarChart2,
  FlaskConical,
  Radio,
  Signal,
} from "lucide-react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ─── Error Boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
          <div className="gallery-card max-w-lg">
            <h1 className="text-2xl font-serif-luxe text-[var(--color-text-main)] mb-3">System Restriction</h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-8 font-mono-code">{this.state.error?.toString()}</p>
            <button onClick={() => window.location.reload()} className="btn-nordic mx-auto">
              Restore Interface
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const emotionColors = {
  neutral:   "#AEB784",
  happy:     "#c2622a",
  sad:       "#41431B",
  angry:     "#c23a2a",
  fearful:   "#41431BCC",
  disgust:   "#41431B",
  surprised: "#c2622aCC",
};

const emotions = ["neutral","happy","sad","angry","fearful","disgust","surprised"];

const TICKER_ITEMS = [
  "FACIAL GEOMETRY ANALYSIS",
  "VOCAL VECTOR EXTRACTION",
  "MULTI-MODAL FUSION ENGINE",
  "EMOTION CLASSIFICATION PROTOCOL",
  "TEMPORAL SEQUENCE MAPPING",
  "NEURAL SYNTHESIS LAYER",
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function TickerBar() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="ticker-wrap py-2 mb-12">
      <div className="ticker-content">
        {items.map((item, i) => (
          <span key={i} className="uppercase-tracking px-8 text-[var(--color-text-muted)] opacity-60">
            {item} <span className="opacity-30 mx-2">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ active = true }) {
  return (
    <span className="relative inline-flex">
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-[var(--color-accent-teal)]" : "bg-[var(--color-border-strong)]"}`} />
      {active && (
        <span className="absolute inset-0 rounded-full bg-[var(--color-accent-teal)] animate-ping opacity-60" />
      )}
    </span>
  );
}

function SectionHeader({ num, label, icon: Icon, status }) {
  return (
    <div className="flex justify-between items-center mb-8 pb-6 border-b border-[var(--color-border-subtle)]">
      <h2 className="text-lg font-serif-luxe flex items-center gap-3 text-[var(--color-text-main)]">
        <span className="font-mono-code text-xs text-[var(--color-text-muted)] font-medium mr-1 tabular-nums">{num}</span>
        {Icon && <Icon className="w-4 h-4 text-[var(--color-text-muted)]" />}
        {label}
      </h2>
      <div className="flex gap-2 items-center">
        <StatusDot active={status === "ready"} />
        <span className="uppercase-tracking">{status === "ready" ? "System Ready" : status}</span>
      </div>
    </div>
  );
}

function EmotionCard({ label, val, icon: Icon, highlight, status }) {
  const color = emotionColors[val] || "#7a6e65";
  return (
    <div
      className={`flex flex-col items-center p-7 rounded-2xl border transition-all duration-300 ${
        highlight
          ? "bg-[var(--color-bg-sidebar)] border-[var(--color-border-strong)] shadow-inner stat-highlight"
          : "bg-white border-[var(--color-border-subtle)]"
      }`}
    >
      <span className="uppercase-tracking mb-5 opacity-60">{status}</span>
      <div
        className="emotion-blob w-16 mb-5 shadow-sm"
        style={{ background: highlight ? `${color}18` : "var(--color-bg-clay)" }}
      >
        <Icon className={`w-7 h-7 ${highlight ? "text-[var(--color-text-main)]" : "text-[var(--color-text-muted)]"}`} />
      </div>
      <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">{label}</span>
      <div
        className={`text-2xl font-serif-luxe capitalize ${
          highlight ? "text-[var(--color-text-main)]" : "text-[var(--color-text-secondary)]"
        }`}
        style={highlight ? { color } : {}}
      >
        {val || "—"}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [recordCountdown, setRecordCountdown] = useState(11);
  const [loaderPercent, setLoaderPercent] = useState(0);
  const [showLoader, setShowLoader] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("Initializing...");

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  // ── Loader Effect ────────────────────────────────────────────────────────
  useEffect(() => {
    let interval;
    if (isProcessing) {
      setShowLoader(true);
      setLoaderPercent(0);
      const start = Date.now();
      interval = setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        if (elapsed < 12) {
          setProcessingStatus("Decoding video stream");
          setLoaderPercent(Math.min(30, Math.floor((elapsed / 12) * 30)));
        } else if (elapsed < 16) {
          setProcessingStatus("Extracting auditory vectors");
          setLoaderPercent(Math.min(60, 30 + Math.floor(((elapsed - 12) / 6) * 30)));
        } else if (elapsed < 22) {
          setProcessingStatus("Neural fusion in progress");
          setLoaderPercent(Math.min(90, 60 + Math.floor(((elapsed - 16) / 6) * 30)));
        } else if (elapsed < 29) {
          setProcessingStatus("AI content synthesis");
          setLoaderPercent(Math.min(98, 90 + Math.floor(((elapsed - 22) / 7) * 8)));
        } else {
          setLoaderPercent(99);
          setProcessingStatus("Finalizing");
        }
      }, 100);
    } else {
      setShowLoader(false);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  // ── Countdown Effect ─────────────────────────────────────────────────────
  useEffect(() => {
    let interval;
    if (isRecording) {
      setRecordCountdown(11);
      interval = setInterval(() => {
        setRecordCountdown((p) => (p <= 1 ? 0 : p - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (isRecording && recordCountdown === 0) stopRecording();
  }, [recordCountdown, isRecording]);

  // ── Recording ────────────────────────────────────────────────────────────
  const startRecording = async () => {
    setRecordError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: true,
      });
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        await processVideo(blob);
        chunksRef.current = [];
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch {
      setRecordError("Camera access restricted");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) setUploadedFile(file);
  };

  const processVideo = async (videoBlob) => {
    if (!videoBlob) return;
    setIsProcessing(true);
    setResults(null);
    const formData = new FormData();
    formData.append("video", videoBlob, "capture.webm");
    try {
      const response = await fetch("/api/process", { method: "POST", body: formData });
      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error("Link failure:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Chart ────────────────────────────────────────────────────────────────
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#7a6e65",
          font: { family: "'DM Sans', sans-serif", size: 10, weight: 600 },
          usePointStyle: true,
          pointStyleWidth: 8,
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: "#1a1612",
        titleFont: { family: "'DM Sans', sans-serif", size: 11 },
        bodyFont: { family: "'DM Mono', monospace", size: 11 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${(ctx.parsed.y * 100).toFixed(1)}%`,
        },
      },
    },
    scales: {
      y: {
        min: 0, max: 1,
        grid: { color: "rgba(196,184,172,0.2)", drawTicks: false },
        border: { display: false },
        ticks: {
          color: "#7a6e65",
          font: { family: "'DM Mono', monospace", size: 9 },
          callback: (v) => `${(v * 100).toFixed(0)}%`,
          maxTicksLimit: 5,
          padding: 8,
        },
      },
      x: {
        grid: { display: false },
        border: { color: "var(--color-border-subtle)" },
        ticks: {
          color: "#7a6e65",
          font: { family: "'DM Mono', monospace", size: 9 },
          maxTicksLimit: 10,
          padding: 6,
        },
      },
    },
    elements: {
      line: { tension: 0.45, borderWidth: 1.5, capStyle: "round" },
      point: { radius: 0, hoverRadius: 3, hoverBorderWidth: 2 },
    },
  };

  const createChartData = (probs = []) => ({
    labels: Array.isArray(probs) ? probs.map((_, i) => `${i}s`) : [],
    datasets: emotions.map((emotion, idx) => ({
      label: emotion,
      data: Array.isArray(probs) ? probs.map((p) => (Array.isArray(p) ? p[idx] : 0)) : [],
      borderColor: emotionColors[emotion],
      backgroundColor: `${emotionColors[emotion]}0c`,
      fill: true,
    })),
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <div className="min-h-screen relative graticule-bg">
        <div className="noise-overlay" aria-hidden="true" />

        {/* Scroll Progress */}
        <motion.div
          className="scroll-progress"
          style={{ scaleX }}
        />

        <div className="relative z-10 flex flex-col">

          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <header className="flex flex-col items-center text-center px-6 pt-16 pb-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
              className="flex flex-col items-center max-w-[1160px] w-full"
            >
              <div className="tag mb-5">
                <Radio className="w-2.5 h-2.5 text-[var(--color-accent-orange)]" />
                Cortex Engine v5.0
              </div>

              <h1 className="font-serif-luxe text-5xl md:text-7xl tracking-tight text-[var(--color-text-main)] mb-4 leading-none">
                Emotion<span className="italic text-[var(--color-accent-orange)]">AI</span>
              </h1>

              <p className="text-sm md:text-base text-[var(--color-text-muted)] font-light max-w-md leading-relaxed">
                A minimalist protocol for human emotional synthesis
                <br />
                <span className="font-mono-code text-[10px] opacity-50">FACIAL · VOCAL · MULTIMODAL</span>
              </p>

              <div className="mt-6 flex items-center gap-6 text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] opacity-40 font-semibold">
                <span>v5.0.1</span>
                <span className="w-px h-3 bg-current" />
                <span>7 Emotion Classes</span>
                <span className="w-px h-3 bg-current" />
                <span>Real-Time Analysis</span>
              </div>
            </motion.div>
          </header>

          {/* ── TICKER ─────────────────────────────────────────────────── */}
          <div className="max-w-[1160px] w-full mx-auto px-6 mb-10">
            <TickerBar />
          </div>

          {/* ── CAPTURE SECTION ────────────────────────────────────────── */}
          <main className="bento-container items-stretch">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
              className="col-span-12"
            >
              <div className="gallery-card corner-accent">
                <SectionHeader num="01" label="Capture" icon={ScanEye} status="ready" />

                <div className="grid md:grid-cols-2 gap-8">

                  {/* Upload */}
                  <div className="flex flex-col gap-4">
                    <div className="group relative h-56 rounded-2xl bg-[var(--color-bg-sidebar)] border border-dashed border-[var(--color-border-strong)] flex items-center justify-center transition-all hover:bg-[var(--color-bg-clay)] hover:border-[var(--color-text-muted)] overflow-hidden cursor-pointer">
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept="video/*"
                      />
                      <label
                        htmlFor="file-upload"
                        className="w-full h-full flex flex-col items-center justify-center p-8 text-center cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-full bg-white border border-[var(--color-border-subtle)] flex items-center justify-center mb-4 shadow-sm transition-transform group-hover:-translate-y-1">
                          <Upload className="w-5 h-5 text-[var(--color-text-muted)]" />
                        </div>
                        <span className="font-semibold text-sm text-[var(--color-text-main)] mb-1">
                          Upload video archive
                        </span>
                        <span className="font-mono-code text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest">
                          MP4 · WEBM · MPEG
                        </span>
                      </label>

                      {uploadedFile && (
                        <div className="absolute bottom-4 inset-x-4 bg-white p-3 rounded-xl border border-[var(--color-border-subtle)] flex items-center justify-between shadow-md">
                          <span className="truncate pr-3 text-xs font-semibold text-[var(--color-text-main)]">
                            {uploadedFile.name}
                          </span>
                          <CheckCircle2 className="w-4 h-4 text-[var(--color-accent-teal)] shrink-0" />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => processVideo(uploadedFile)}
                      disabled={!uploadedFile || isProcessing}
                      className="btn-nordic w-full py-3.5"
                    >
                      {isProcessing ? (
                        <Loader2 className="animate-spin w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                      Analyze Signal
                    </button>
                  </div>

                  {/* Live camera */}
                  <div className="flex flex-col gap-4">
                    <div className="video-container h-56 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-sidebar)] relative overflow-hidden shadow-inner">

                      {/* Scan line when recording */}
                      {isRecording && <div className="scan-line" />}

                      {/* REC badge */}
                      <AnimatePresence>
                        {isRecording && (
                          <motion.div
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            className="absolute top-4 left-4 z-20 flex items-center gap-2.5 bg-white/90 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-[var(--color-border-subtle)] shadow-md"
                          >
                            <div className="relative">
                              <div className="w-2 h-2 bg-[var(--color-accent-red)] rounded-full" />
                              <div className="pulse-ring" style={{ inset: "-2px", borderColor: "var(--color-accent-red)" }} />
                            </div>
                            <span className="font-mono-code text-[10px] font-medium text-[var(--color-text-main)]">
                              REC 0:{recordCountdown < 10 ? `0${recordCountdown}` : recordCountdown}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover opacity-90 grayscale transition-all duration-500 hover:grayscale-0 hover:opacity-100"
                        autoPlay
                        playsInline
                        muted
                      />

                      {!isRecording && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-clay)]/30 backdrop-blur-[2px]">
                          <Video className="w-8 h-8 text-[var(--color-text-muted)] mb-2 opacity-30" />
                          <span className="font-mono-code text-[9px] font-medium uppercase tracking-[0.3em] text-[var(--color-text-muted)] opacity-40">
                            Sensor inactive
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={startRecording}
                        disabled={isRecording || isProcessing}
                        className="btn-nordic btn-outline flex-1 py-3.5"
                      >
                        <Mic className="w-4 h-4" />
                        Start Live Feed
                      </button>
                      <button
                        onClick={stopRecording}
                        disabled={!isRecording}
                        className="px-5 rounded-xl border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all disabled:opacity-30 shadow-sm"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    </div>

                    {recordError && (
                      <p className="text-xs font-mono-code text-[var(--color-accent-red)] opacity-80 text-center">
                        ⚠ {recordError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.section>

            {/* ── LOADER ──────────────────────────────────────────────── */}
            <AnimatePresence>
              {showLoader && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.4 }}
                  className="col-span-12"
                >
                  <div className="gallery-card py-14 flex flex-col items-center justify-center text-center bg-[var(--color-bg-sidebar)]">
                    <div className="flex items-center gap-3 mb-8">
                      {loaderPercent < 30 ? (
                        <ScanEye className="w-5 h-5 text-[var(--color-text-muted)] animate-pulse" />
                      ) : loaderPercent < 60 ? (
                        <Volume2 className="w-5 h-5 text-[var(--color-text-muted)] animate-pulse" />
                      ) : loaderPercent < 90 ? (
                        <Zap className="w-5 h-5 text-[var(--color-accent-orange)] animate-pulse" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-[var(--color-accent-teal)]" />
                      )}
                      <span className="font-mono-code text-xs tracking-widest text-[var(--color-text-main)] cursor-blink">
                        {processingStatus}
                      </span>
                    </div>

                    <div className="w-full max-w-sm">
                      <div className="flex justify-between items-baseline mb-3">
                        <span className="uppercase-tracking">Neural Progress</span>
                        <span className="font-mono-code text-2xl font-medium text-[var(--color-text-main)]">
                          {loaderPercent}
                          <span className="text-sm text-[var(--color-text-muted)]">%</span>
                        </span>
                      </div>
                      <div className="loading-bar-container">
                        <motion.div
                          className="loading-bar-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${loaderPercent}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>

                    <p className="mt-8 text-xs text-[var(--color-text-muted)] font-light italic max-w-xs leading-relaxed">
                      Computational shards calibrating for {processingStatus.toLowerCase()}…
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* ── RESULTS ──────────────────────────────────────────────────── */}
          <AnimatePresence>
            {results && !results.error && !isProcessing && (
              <motion.section
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                className="bento-container"
              >

                {/* ── Emotion Summary ───────────────────────────────────── */}
                <div className="col-span-12 gallery-card">
                  <SectionHeader num="02" label="Synthesis" icon={Brain} status="complete" />

                  <div className="grid md:grid-cols-3 gap-5 mb-10">
                    <EmotionCard label="Vocal Layer" val={results?.audio_emotion || "—"} icon={Volume2} status="Channel 01" />
                    <EmotionCard label="Visual Layer" val={results?.video_emotion || "—"} icon={ScanEye} status="Channel 02" />
                    <EmotionCard label="Consensus" val={results?.fused_emotion || "—"} icon={Brain} status="Final Fusion" highlight />
                  </div>

                  <div className="px-8 py-10 rounded-2xl bg-[var(--color-bg-sidebar)] border border-[var(--color-border-subtle)] text-center">
                    <div className="font-mono-code text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mb-4 opacity-50">
                      Reasoning output
                    </div>
                    <p className="text-xl md:text-2xl font-serif-luxe italic text-[var(--color-text-secondary)] leading-relaxed max-w-2xl mx-auto">
                      "{results.reasoning}"
                    </p>
                  </div>
                </div>

                {/* ── Vocal Chart ───────────────────────────────────────── */}
                <div className="col-span-12 lg:col-span-6 gallery-card" style={{ height: 440 }}>
                  <div className="flex justify-between items-center mb-6 pb-5 border-b border-[var(--color-border-subtle)]">
                    <h3 className="font-serif-luxe text-lg text-[var(--color-text-main)] flex items-center gap-2.5">
                      <Volume2 className="w-4 h-4 text-[var(--color-text-muted)]" />
                      Vocal Trajectory
                    </h3>
                    <span className="tag">Temporal Log</span>
                  </div>
                  <div style={{ height: 300 }}>
                    {Array.isArray(results?.audio_probs_temporal) && results.audio_probs_temporal.length > 0 ? (
                      <Line data={createChartData(results.audio_probs_temporal)} options={chartOptions} />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] opacity-30 italic">
                        <Activity className="w-8 h-8 mb-2" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest">Signal Interrupt</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Facial Chart ──────────────────────────────────────── */}
                <div className="col-span-12 lg:col-span-6 gallery-card" style={{ height: 440 }}>
                  <div className="flex justify-between items-center mb-6 pb-5 border-b border-[var(--color-border-subtle)]">
                    <h3 className="font-serif-luxe text-lg text-[var(--color-text-main)] flex items-center gap-2.5">
                      <ScanEye className="w-4 h-4 text-[var(--color-text-muted)]" />
                      Facial Geometry
                    </h3>
                    <span className="tag">Flow Analysis</span>
                  </div>
                  <div style={{ height: 300 }}>
                    {results?.video_probs_temporal?.length > 0 ? (
                      <Line data={createChartData(results.video_probs_temporal)} options={chartOptions} />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] opacity-30 italic">
                        <Activity className="w-8 h-8 mb-2" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest">Signal Interrupt</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Narratives Header ─────────────────────────────────── */}
                <div className="col-span-12 pt-10">
                  <div className="section-divider mb-12">
                    <h2 className="font-serif-luxe text-3xl text-[var(--color-text-muted)] px-4 shrink-0">
                      <span className="font-mono-code text-sm text-[var(--color-text-muted)]/50 font-normal mr-2">03</span>
                      Narratives
                    </h2>
                  </div>

                  <div className="grid lg:grid-cols-12 gap-6 items-start">

                    {/* Story + Quote */}
                    <div className="lg:col-span-7 flex flex-col gap-5">
                      <motion.div
                        initial={{ opacity: 0, x: -16 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="gallery-card bg-[var(--color-bg-sidebar)]"
                      >
                        <h4 className="flex items-center gap-3 text-base font-semibold mb-5 text-[var(--color-text-main)]">
                          <BookOpen className="w-4 h-4 text-[var(--color-text-muted)]" />
                          The Story
                        </h4>
                        <p className="text-lg font-serif-luxe leading-relaxed text-[var(--color-text-secondary)] italic">
                          {results?.story
                            ? `${results.story.split(" ").slice(0, 32).join(" ")}…`
                            : "Narrative analysis pending…"}
                        </p>
                        <button
                          onClick={() => setShowStoryModal(true)}
                          disabled={!results?.story}
                          className="mt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-main)] hover:text-[var(--color-accent-orange)] flex items-center gap-2.5 transition-colors disabled:opacity-30 group"
                        >
                          Explore cinematic narrative
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="gallery-card bg-white"
                      >
                        <h4 className="flex items-center gap-3 text-base font-semibold mb-5 text-[var(--color-text-main)]">
                          <Sparkles className="w-4 h-4 text-[var(--color-text-muted)]" />
                          Reflection
                        </h4>
                        <blockquote className="text-2xl md:text-3xl font-serif-luxe leading-snug text-[var(--color-text-main)] italic">
                          {results?.quote ? `"${results.quote}"` : "Reflection synthesis in progress…"}
                        </blockquote>
                      </motion.div>
                    </div>

                    {/* Curations */}
                    <div className="lg:col-span-5">
                      <motion.div
                        initial={{ opacity: 0, x: 16 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="gallery-card h-full flex flex-col"
                      >
                        <h4 className="flex items-center gap-3 text-base font-semibold mb-7 pb-6 border-b border-[var(--color-border-subtle)] text-[var(--color-text-main)]">
                          <Headphones className="w-5 h-5 text-[var(--color-text-muted)]" />
                          Curations
                        </h4>

                        <div className="space-y-7 flex-1">
                          {results.video && (
                            <div className="p-5 rounded-2xl bg-[var(--color-bg-sidebar)] border border-[var(--color-border-subtle)] hover:bg-white transition-all">
                              <div className="flex items-center gap-3 mb-3">
                                <Youtube className="text-[var(--color-accent-orange)] w-5 h-5" />
                                <span className="uppercase-tracking">Visual Catalyst</span>
                              </div>
                              <p className="text-xs text-[var(--color-text-secondary)] mb-5 leading-relaxed">
                                {results.video?.replace(/https:\/\/\S+/g, "")}
                              </p>
                              {results.video?.match(/https:\/\/\S+/g) && (
                                <a
                                  href={results.video.match(/https:\/\/\S+/g)[0]}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-nordic w-full py-3 text-[11px]"
                                >
                                  Open Archive <ArrowRight className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          )}

                          <div className="space-y-1">
                            {results.songs?.map((song, i) => (
                              <motion.div
                                key={i}
                                className="song-item"
                                whileHover={{ x: 6 }}
                                transition={{ type: "spring", stiffness: 300 }}
                              >
                                <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-sidebar)] flex items-center justify-center font-mono-code text-[10px] font-semibold text-[var(--color-text-muted)] shrink-0 border border-[var(--color-border-subtle)]">
                                  0{i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-[var(--color-text-main)] leading-tight truncate">
                                    {song.artist} — {song.title}
                                  </div>
                                  <div className="text-[10px] text-[var(--color-text-muted)] italic truncate mt-0.5">
                                    {song.explanation}
                                  </div>
                                </div>
                                <a
                                  href={song.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 rounded-full hover:bg-[var(--color-bg-clay)] transition-colors opacity-0 group-hover:opacity-100"
                                  style={{ opacity: 1 }}
                                >
                                  <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                                </a>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* ── ERROR STATE ──────────────────────────────────────────────── */}
          {results?.error && (
            <div className="flex justify-center px-6 py-16">
              <div className="gallery-card border-[var(--color-border-strong)] bg-white text-center max-w-md w-full">
                <div className="w-12 h-12 rounded-full bg-[var(--color-bg-sidebar)] border border-[var(--color-border-subtle)] flex items-center justify-center mx-auto mb-5">
                  <Zap className="w-5 h-5 text-[var(--color-accent-orange)]" />
                </div>
                <h3 className="font-serif-luxe text-xl mb-2 text-[var(--color-text-main)]">Core Failure</h3>
                <p className="text-sm text-[var(--color-text-muted)] mb-7 leading-relaxed font-light">{results.error}</p>
                <button onClick={() => setResults(null)} className="btn-nordic w-full py-3">
                  Re-Initialize System
                </button>
              </div>
            </div>
          )}

          {/* ── STORY MODAL ──────────────────────────────────────────────── */}
          <AnimatePresence>
            {showStoryModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-6 modal-backdrop"
                onClick={(e) => e.target === e.currentTarget && setShowStoryModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.93, opacity: 0, y: 16 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.93, opacity: 0, y: 16 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="gallery-card max-w-2xl w-full max-h-[80vh] overflow-y-auto relative bg-white shadow-2xl"
                  style={{ padding: "2.5rem" }}
                >
                  <button
                    onClick={() => setShowStoryModal(false)}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-[var(--color-bg-sidebar)] transition-colors"
                  >
                    <X className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </button>

                  <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[var(--color-border-subtle)]">
                    <BookOpen className="w-5 h-5 text-[var(--color-text-muted)]" />
                    <h4 className="font-serif-luxe text-xl text-[var(--color-text-main)]">
                      Complete Emotional Narrative
                    </h4>
                  </div>

                  <div className="text-lg font-serif-luxe leading-relaxed text-[var(--color-text-secondary)] italic pr-1">
                    {results.story}
                  </div>

                  <div className="mt-10 pt-6 border-t border-[var(--color-border-subtle)] flex justify-between items-center">
                    <span className="font-mono-code text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] opacity-50">
                      Nuance Engine Analysis
                    </span>
                    <span className="font-mono-code text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] opacity-50">
                      © 2026 EmotionAI
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── FOOTER ───────────────────────────────────────────────────── */}
          <footer className="mt-28 pt-12 pb-14 border-t border-[var(--color-border-subtle)] flex flex-col items-center gap-5 px-6">
            <div className="flex flex-wrap justify-center gap-8 text-[10px] font-semibold tracking-widest text-[var(--color-text-muted)] uppercase opacity-40">
              <span>Cortex_Core_v5.0</span>
              <span>·</span>
              <span>Claude_Sync_Protocol</span>
              <span>·</span>
              <span>EmotionAI_Labs</span>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] opacity-30 font-mono-code uppercase tracking-tight">
              © 2026 EmotionAI — Built for clarity and insight
            </p>
          </footer>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;