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
    borderWidth: 3,
    pointRadius: 0,
    pointHoverRadius: 5,
    tension: 0.35,
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
    borderWidth: 2.5,
    pointRadius: 0,
    tension: 0.2,
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
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'top',
      labels: {
        boxWidth: 8,
        usePointStyle: true,
        pointStyle: 'circle',
        font: { size: 10, weight: 'bold' },
        color: 'var(--color-text-muted)',
        padding: 15
      }
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      padding: 12,
      titleFont: { size: 13, weight: 'bold' },
      bodyFont: { size: 12 },
      cornerRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      callbacks: hasProbs ? {
        label: (ctx) => ` ${ctx.dataset.label}: ${(ctx.parsed.y * 100).toFixed(1)}%`
      } : undefined
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: 'var(--color-text-muted)', font: { size: 10 } },
      title: { display: true, text: 'Time (Seconds)', color: 'var(--color-text-muted)', font: { size: 9, weight: 'bold' } }
    },
    y: {
      min: -0.05,
      max: 1.05,
      grace: '5%',
      grid: { color: 'rgba(255,255,255,0.03)' },
      ticks: { 
        color: 'var(--color-text-muted)', 
        font: { size: 10 },
        callback: (v) => (v >= 0 && v <= 1 && hasProbs) ? `${Math.round(v * 100)}%` : ''
      }
    }
  }
});

export default function TemporalChart({ results }) {
  if (!results) return null;

  const audioProbs = results.audio_preds || [];
  const videoProbs = results.video_preds || [];
  const audioNames = results.audio_temporal || [];
  const videoNames = results.video_temporal || [];

  const hasAudioProbs = audioProbs.length > 0;
  const hasVideoProbs = videoProbs.length > 0;
  const hasAudio = hasAudioProbs || audioNames.length > 0;
  const hasVideo = hasVideoProbs || videoNames.length > 0;

  if (!hasAudio && !hasVideo) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-up">
      <div className="flex items-center gap-3 px-2">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">
           Dynamic Mapping
        </h3>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {hasAudio && (
          <div className="panel p-6 bg-surface-base">
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-6 text-center">Audio Modality Engine</h4>
            <div className="h-64">
              <Line
                data={hasAudioProbs ? buildProbDataset(audioProbs) : buildNameDataset(audioNames)}
                options={chartOptions(hasAudioProbs)}
              />
            </div>
          </div>
        )}
        {hasVideo && (
          <div className="panel p-6 bg-surface-base">
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-6 text-center">Video Modality Engine</h4>
            <div className="h-64">
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
