import { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarRange, Sparkles, Brain, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import axios from 'axios';

const ipc = typeof window !== 'undefined' && window.require
  ? window.require('electron').ipcRenderer
  : null;

const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgust', 'surprised'];
const EMOTION_COLORS = {
  happy: '#16A34A', neutral: '#64748B', surprised: '#EA580C',
  sad: '#3B82F6', fearful: '#9333EA', angry: '#E11D48', disgust: '#65A30D',
};
const POSITIVE = ['happy', 'neutral', 'surprised'];
const NEGATIVE = ['sad', 'angry', 'fearful', 'disgust'];

const RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all',   label: 'All Time' },
];

export default function CalendarView() {
  const [history, setHistory]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [range, setRange]             = useState('week');
  const [analysisText, setAnalysisText] = useState('');
  const [analyzing, setAnalyzing]     = useState(false);
  const [analysisDate, setAnalysisDate] = useState(null);

  // Load results from Electron userData or Flask fallback
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      if (ipc) {
        const data = await ipc.invoke('load-results');
        setHistory(Array.isArray(data) ? data : []);
      } else {
        const { data } = await axios.get('/history?limit=500');
        setHistory(data);
      }
    } catch(e) {
      console.error('Failed to load history:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Filter history by selected range
  const filtered = useMemo(() => {
    const now = new Date();
    return history.filter(row => {
      const t = new Date(row.timestamp);
      if (range === 'today') return t.toDateString() === now.toDateString();
      if (range === 'week')  { const w = new Date(now); w.setDate(w.getDate() - 7); return t >= w; }
      if (range === 'month') { const m = new Date(now); m.setMonth(m.getMonth() - 1); return t >= m; }
      return true;
    });
  }, [history, range]);

  // Group by hour of day
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, entries: [] }));
    filtered.forEach(row => {
      const h = new Date(row.timestamp).getHours();
      hours[h].entries.push(row.fused_emotion);
    });
    return hours;
  }, [filtered]);

  // Dominant emotion for a bucket
  const dominant = (entries) => {
    if (!entries.length) return null;
    const freq = {};
    entries.forEach(e => { freq[e] = (freq[e] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  };

  // Summary stats
  const summary = useMemo(() => {
    const ems = filtered.map(r => r.fused_emotion);
    if (!ems.length) return null;
    const pos = ems.filter(e => POSITIVE.includes(e)).length;
    const neg = ems.filter(e => NEGATIVE.includes(e)).length;
    const posRatio = pos / ems.length;
    return { total: ems.length, pos, neg, posRatio };
  }, [filtered]);

  // Key to cache analysis per range+date
  const cacheKey = `${range}_${new Date().toISOString().slice(0, 10)}`;

  // Load cached analysis for this range/day
  useEffect(() => {
    const loadCached = async () => {
      if (ipc) {
        const cached = await ipc.invoke('load-analysis', cacheKey);
        if (cached) {
          setAnalysisText(cached.text);
          setAnalysisDate(cached.date);
        } else {
          setAnalysisText('');
          setAnalysisDate(null);
        }
      }
    };
    loadCached();
  }, [cacheKey]);

  // Run LLM analysis
  const handleAnalyze = async () => {
    if (!filtered.length || analyzing) return;
    setAnalyzing(true);
    try {
      const { data } = await axios.post('http://127.0.0.1:5000/analyze_history', {
        history: filtered.slice(0, 60)
      });
      const result = {
        text: data.analysis,
        date: new Date().toLocaleString(),
        range,
      };
      setAnalysisText(result.text);
      setAnalysisDate(result.date);

      // Persist so user doesn't need to re-run on same day
      if (ipc) await ipc.invoke('save-analysis', cacheKey, result);
    } catch {
      setAnalysisText('Analysis failed. Ensure the backend is running and your API key is configured.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-text-muted text-sm">
      Loading your history...
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-up pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-primary">History</h1>
          <p className="text-sm text-text-muted mt-1">Review your emotional and stress patterns over time.</p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing || !filtered.length}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-primary/40 text-primary text-sm font-bold hover:bg-primary/5 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {analyzing
            ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            : <Sparkles className="w-4 h-4" />
          }
          {analysisDate ? 'Refresh Analysis' : 'Run Analysis'}
        </button>
      </div>

      {/* Range filter */}
      <div className="inline-flex bg-surface-raised rounded-xl p-1 gap-1 border border-border-subtle">
        {RANGES.map(r => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              range === r.id ? 'bg-primary text-white shadow' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="panel p-4 text-center">
            <p className="text-2xl font-black text-text-primary">{summary.total}</p>
            <p className="text-xs text-text-muted mt-1 font-medium">Total Readings</p>
          </div>
          <div className="panel p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <p className="text-2xl font-black text-green-600">{summary.pos}</p>
            </div>
            <p className="text-xs text-text-muted font-medium">Positive States</p>
          </div>
          <div className="panel p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <p className="text-2xl font-black text-red-500">{summary.neg}</p>
            </div>
            <p className="text-xs text-text-muted font-medium">High Stress Signals</p>
          </div>
        </div>
      )}

      {/* Celebration / Encouragement Banner */}
      {summary && (
        <div className={`p-4 rounded-xl border text-sm font-medium ${
          summary.posRatio >= 0.6
            ? 'bg-green-50 border-green-200 text-green-700'
            : summary.posRatio <= 0.3
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          {summary.posRatio >= 0.6 && (
            <>Great work. {Math.round(summary.posRatio * 100)}% of your readings show calmer or positive states. Keep this rhythm going.</>
          )}
          {summary.posRatio <= 0.3 && (
            <>High stress signals showed up in this period. You are not alone. Try short breaks, hydration, and stepping away from the screen for a few minutes.</>
          )}
          {summary.posRatio > 0.3 && summary.posRatio < 0.6 && (
            <>Mixed emotional patterns appeared in this period. Small workday habits can still lower stress over time.</>
          )}
        </div>
      )}

      {/* Hourly Heatmap */}
      {filtered.length > 0 ? (
        <div className="panel p-6">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Emotion by Hour of Day
          </h2>
          <div className="grid grid-cols-12 gap-1.5">
            {hourlyData.map(({ hour, entries }) => {
              const em = dominant(entries);
              const color = em ? EMOTION_COLORS[em] : null;
              return (
                <div key={hour} className="group relative">
                  <div
                    className="h-10 rounded-lg border border-border-subtle transition-all duration-200 group-hover:scale-110 group-hover:z-10 group-hover:shadow-lg cursor-default"
                    style={{
                      backgroundColor: color ? `${color}33` : 'var(--color-surface-raised)',
                      borderColor: color ? `${color}66` : undefined,
                    }}
                  />
                  {/* Tooltip */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1.5 px-2 py-1 bg-text-primary text-white text-[10px] rounded-md whitespace-nowrap z-20 shadow-lg">
                    {hour}:00 — {em ? em : 'no data'} {entries.length > 0 && `(${entries.length})`}
                  </div>
                  <p className="text-[9px] text-text-muted text-center mt-1 leading-none">{hour}</p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            {EMOTIONS.map(e => (
              <div key={e} className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: EMOTION_COLORS[e] }} />
                <span className="capitalize">{e}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="panel p-12 text-center">
          <CalendarRange className="w-12 h-12 text-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-text-muted">No readings for this period yet.</p>
          <p className="text-xs text-text-muted mt-1">Enable Auto Mode to start background monitoring.</p>
        </div>
      )}

      {/* LLM Analysis Result */}
      {analysisText && (
        <div className="panel p-6 border border-primary/20 bg-primary/5 animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">AI Stress Report</h3>
            {analysisDate && <span className="ml-auto text-[10px] text-text-muted">Generated {analysisDate}</span>}
          </div>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{analysisText}</p>
        </div>
      )}

      {/* Raw Table */}
      {filtered.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle">
            <h2 className="text-sm font-bold text-text-primary">Raw Readings</h2>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-raised border-b border-border-subtle sticky top-0">
                <tr>
                  <th className="px-5 py-3 font-bold text-text-secondary uppercase tracking-wider">Time</th>
                  <th className="px-5 py-3 font-bold text-text-secondary uppercase tracking-wider">Emotion</th>
                  <th className="px-5 py-3 font-bold text-text-secondary uppercase tracking-wider hidden sm:table-cell">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((row, i) => (
                  <tr key={i} className="hover:bg-surface-raised/60 transition-colors">
                    <td className="px-5 py-3 text-text-muted font-mono whitespace-nowrap">
                      {new Date(row.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-bold capitalize" style={{ color: EMOTION_COLORS[row.fused_emotion] || 'inherit' }}>
                        {row.fused_emotion || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-text-muted max-w-xs truncate hidden sm:table-cell">{row.reasoning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
