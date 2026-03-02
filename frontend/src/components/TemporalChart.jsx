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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgust', 'surprised'];
const EMOTION_COLORS = {
  neutral:   '#c4a8b0',
  happy:     '#22C55E',
  sad:       '#3B82F6',
  angry:     '#EF4444',
  fearful:   '#A855F7',
  disgust:   '#84CC16',
  surprised: '#F59E0B',
};

function buildTimelineDataset(temporal) {
  const labels = temporal.map((_, i) => `${i + 1}`);
  const datasets = EMOTIONS.map((em) => ({
    label: em.charAt(0).toUpperCase() + em.slice(1),
    data: temporal.map((t) => (t === em ? 1 : 0)),
    borderColor: EMOTION_COLORS[em],
    backgroundColor: EMOTION_COLORS[em] + '18',
    borderWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 5,
    tension: 0.35,
    fill: false,
  }));
  return { labels, datasets };
}

const chartOptions = (title) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: '#c4a8b0',
        font: { family: 'Inter', size: 11 },
        boxWidth: 10,
        padding: 12,
      },
    },
    title: {
      display: true,
      text: title,
      color: '#f1f5f9',
      font: { family: 'Inter', size: 13, weight: '600' },
      padding: { bottom: 12 },
    },
    tooltip: {
      backgroundColor: '#5E1525',
      borderColor: 'rgba(213,207,47,0.25)',
      borderWidth: 1,
      titleFont: { family: 'Inter' },
      bodyFont: { family: 'Inter' },
    },
  },
  scales: {
    x: {
      ticks: { color: '#8a6670', font: { size: 10 } },
      grid: { color: 'rgba(138,102,112,0.1)' },
      title: { display: true, text: 'Time Segment', color: '#8a6670', font: { size: 10 } },
    },
    y: {
      min: -0.1,
      max: 1.1,
      ticks: {
        color: '#8a6670',
        font: { size: 10 },
        callback: (v) => (v === 0 ? '' : v === 1 ? 'Active' : ''),
      },
      grid: { color: 'rgba(138,102,112,0.08)' },
    },
  },
});

export default function TemporalChart({ results }) {
  if (!results) return null;
  const audioTemporal = results.audio_temporal || [];
  const videoTemporal = results.video_temporal || [];
  if (audioTemporal.length === 0 && videoTemporal.length === 0) return null;

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: '0.2s' }}>
      {audioTemporal.length > 0 && (
        <div className="glass glow-border rounded-2xl p-5">
          <div className="h-64">
            <Line data={buildTimelineDataset(audioTemporal)} options={chartOptions('Audio Temporal Emotions')} />
          </div>
        </div>
      )}
      {videoTemporal.length > 0 && (
        <div className="glass glow-border rounded-2xl p-5">
          <div className="h-64">
            <Line data={buildTimelineDataset(videoTemporal)} options={chartOptions('Video Temporal Emotions')} />
          </div>
        </div>
      )}
    </div>
  );
}
