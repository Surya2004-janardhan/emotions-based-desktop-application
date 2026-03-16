import { Line } from 'react-chartjs-2';
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
} from 'chart.js';
import { Activity } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgust', 'surprised'];
const EMOTION_COLORS = {
  neutral:   '#94A3B8',
  happy:     '#22C55E',
  sad:       '#6499E9',
  angry:     '#F43F5E',
  fearful:   '#A855F7',
  disgust:   '#84CC16',
  surprised: '#FB923C',
};

const EMOTION_LABELS = {
  neutral:   'Normal',
  happy:     'Vibrant',
  sad:       'Mellow',
  angry:     'Intense',
  fearful:   'Alert',
  disgust:   'Averse',
  surprised: 'Novel',
};

function LegendItem({ emotion, color }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-surface-raised border border-border-subtle hover:border-primary/30 transition-all">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-tight">
        {EMOTION_LABELS[emotion]}
      </span>
    </div>
  );
}

/**
 * Build dataset from probability arrays (smooth curves).
 */
function buildProbDataset(probs) {
  const labels = probs.map((_, i) => `${(i * 0.5).toFixed(1)}s`);
  const datasets = EMOTIONS.map((em, idx) => ({
    label: em.charAt(0).toUpperCase() + em.slice(1),
    data: probs.map((p) => p[idx]),
    borderColor: EMOTION_COLORS[em],
    backgroundColor: EMOTION_COLORS[em] + '10',
    borderWidth: 2.5,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.4,
    fill: true,
    spanGaps: true,
  }));
  return { labels, datasets };
}

/**
 * Fallback: build from emotion name arrays (binary spikes).
 */
function buildNameDataset(temporal) {
  const labels = temporal.map((_, i) => `${(i * 0.5).toFixed(1)}s`);
  const datasets = EMOTIONS.map((em) => ({
    label: em.charAt(0).toUpperCase() + em.slice(1),
    data: temporal.map((t) => (t === em ? 1 : 0)),
    borderColor: EMOTION_COLORS[em],
    backgroundColor: EMOTION_COLORS[em] + '20',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.1,
    fill: true,
  }));
  return { labels, datasets };
}

/**
 * Common chart options with high visibility for all 7 emotions.
 */
const chartOptions = (hasProbs) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 1500, easing: 'easeOutQuart' },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)', // Light background
      titleColor: '#0F172A',
      bodyColor: '#475569',
      padding: 12,
      titleFont: { size: 13, weight: 'bold' },
      bodyFont: { size: 12 },
      cornerRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(15,23,42,0.1)',
      callbacks: hasProbs ? {
        label: (ctx) => ` ${ctx.dataset.label}: ${(ctx.parsed.y * 100).toFixed(1)}%`
      } : undefined
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { 
        color: '#0F172A', // Dark for light theme
        font: { size: 10, weight: '700' },
        padding: 8
      },
      title: { 
        display: true, 
        text: 'TIMELINE (S)', 
        color: '#3B82F6', // Theme primary
        font: { size: 10, weight: '900' },
        padding: { top: 6 },
        textStrokeWidth: 0
      }
    },
    y: {
      min: -0.02,
      max: 1.05,
      grid: { color: 'rgba(15, 23, 42, 0.05)' },
      title: { 
        display: true, 
        text: 'PROBABILITY (%)', 
        color: '#3B82F6', 
        font: { size: 10, weight: '900' },
        padding: { bottom: 10 }
      },
      ticks: { 
        color: '#0F172A', // Dark for light theme
        font: { size: 10, weight: '700' },
        padding: 10,
        callback: (v) => (v >= 0 && v <= 1 && hasProbs) ? `${Math.round(v * 100)}%` : ''
      }
    }
  }
});

export default function TemporalChart({ results }) {
  if (!results) return null;

  const audioProbs = results.audio_probs_temporal || [];
  const videoProbs = results.video_probs_temporal || [];
  const audioNames = results.audio_temporal || [];
  const videoNames = results.video_temporal || [];

  const hasAudioProbs = audioProbs.length > 0;
  const hasVideoProbs = videoProbs.length > 0;
  const hasAudio = hasAudioProbs || audioNames.length > 0;
  const hasVideo = hasVideoProbs || videoNames.length > 0;

  if (!hasAudio && !hasVideo) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-up px-4">
      <div className="flex items-center gap-3">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-black text-text-primary uppercase tracking-[0.2em]">
           Temporal Distribution Engine
        </h3>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {hasAudio && (
          <div className="panel p-8 bg-surface-base flex flex-col">
            <div className="flex flex-col items-center mb-8">
               <h4 className="text-[11px] font-black text-text-primary uppercase tracking-[0.15em] mb-4">Audio Modality Engine</h4>
               <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                 {EMOTIONS.map(em => <LegendItem key={em} emotion={em} color={EMOTION_COLORS[em]} />)}
               </div>
            </div>
            <div className="h-[320px] w-full mt-auto">
              <Line
                data={hasAudioProbs ? buildProbDataset(audioProbs) : buildNameDataset(audioNames)}
                options={chartOptions(hasAudioProbs)}
              />
            </div>
          </div>
        )}
        {hasVideo && (
          <div className="panel p-8 bg-surface-base flex flex-col">
            <div className="flex flex-col items-center mb-8">
               <h4 className="text-[11px] font-black text-text-primary uppercase tracking-[0.15em] mb-4">Video Modality Engine</h4>
               <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                 {EMOTIONS.map(em => <LegendItem key={em} emotion={em} color={EMOTION_COLORS[em]} />)}
               </div>
            </div>
            <div className="h-[320px] w-full mt-auto">
              <Line
                data={hasVideoProbs ? buildProbDataset(videoProbs) : buildNameDataset(videoNames)}
                options={chartOptions(hasVideoProbs)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
