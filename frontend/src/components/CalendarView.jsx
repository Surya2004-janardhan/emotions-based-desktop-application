import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CalendarRange,
  Sparkles,
  Brain,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  BarChart3,
} from "lucide-react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { logError, logInfo } from "../utils/logger";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);

const ipc =
  typeof window !== "undefined" && window.require
    ? window.require("electron").ipcRenderer
    : null;

const EMOTIONS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "fearful",
  "disgust",
  "surprised",
];
const EMOTION_COLORS = {
  happy: "#16A34A",
  neutral: "#64748B",
  surprised: "#EA580C",
  sad: "#3B82F6",
  fearful: "#9333EA",
  angry: "#E11D48",
  disgust: "#65A30D",
};
const POSITIVE = ["happy", "neutral", "surprised"];
const NEGATIVE = ["sad", "angry", "fearful", "disgust"];
const STRESS_BASELINE = {
  happy: 0.15,
  neutral: 0.25,
  surprised: 0.45,
  sad: 0.65,
  disgust: 0.7,
  fearful: 0.8,
  angry: 0.85,
};

const RANGES = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "all", label: "All Time" },
];

export default function CalendarView({ groqApiKey = '' }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("week");
  const [analysisText, setAnalysisText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDate, setAnalysisDate] = useState(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    logInfo("history", "load start");
    try {
      if (ipc) {
        const data = await ipc.invoke("load-results");
        setHistory(Array.isArray(data) ? data : []);
        logInfo("history", "load complete via ipc", {
          count: Array.isArray(data) ? data.length : 0,
        });
      } else {
        const { data } = await axios.get("/history?limit=500");
        setHistory(Array.isArray(data) ? data : []);
        logInfo("history", "load complete via api", {
          count: Array.isArray(data) ? data.length : 0,
        });
      }
    } catch (e) {
      logError("history", "load failed", { error: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const dominant = useCallback((entries) => {
    if (!entries.length) return null;
    const freq = {};
    entries.forEach((e) => {
      freq[e] = (freq[e] || 0) + 1;
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  }, []);

  const estimateRowStress = useCallback((row) => {
    if (typeof row.stress_score === "number") return row.stress_score;
    const baseline = STRESS_BASELINE[row.fused_emotion] ?? 0.35;
    const transition =
      typeof row.transition_rate === "number" ? row.transition_rate : 0.25;
    const stability =
      typeof row.stability === "number"
        ? row.stability
        : typeof row.emotional_stability === "number"
          ? row.emotional_stability
          : 0.65;
    return Math.max(
      0,
      Math.min(1, baseline + 0.2 * transition + 0.1 * (1 - stability)),
    );
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return history.filter((row) => {
      const t = new Date(row.timestamp);
      if (range === "today") return t.toDateString() === now.toDateString();
      if (range === "week") {
        const w = new Date(now);
        w.setDate(w.getDate() - 7);
        return t >= w;
      }
      if (range === "month") {
        const m = new Date(now);
        m.setMonth(m.getMonth() - 1);
        return t >= m;
      }
      return true;
    });
  }, [history, range]);

  const isTodayRange = range === "today";

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      entries: [],
    }));
    filtered.forEach((row) => {
      const h = new Date(row.timestamp).getHours();
      hours[h].entries.push(row.fused_emotion);
    });
    return hours;
  }, [filtered]);

  const periodBoxes = useMemo(() => {
    const now = new Date();
    const byDay = new Map();
    filtered.forEach((row) => {
      const date = new Date(row.timestamp);
      const key = date.toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(row);
    });

    const buildDayEntry = (date) => {
      const key = date.toISOString().slice(0, 10);
      const rows = byDay.get(key) || [];
      const dominantEmotion = dominant(rows.map((r) => r.fused_emotion));
      const avgStress =
        rows.length > 0
          ? rows.reduce((sum, row) => sum + estimateRowStress(row), 0) /
            rows.length
          : null;
      return { key, label: date.getDate(), rows, dominantEmotion, avgStress };
    };

    if (range === "week") {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(now.getDate() - i);
        days.push(buildDayEntry(date));
      }
      return days;
    }

    if (range === "month") {
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      return Array.from({ length: daysInMonth }, (_, idx) => {
        const date = new Date(year, month, idx + 1);
        return buildDayEntry(date);
      });
    }

    return [];
  }, [filtered, range, estimateRowStress, dominant]);

  const allTimeTrend = useMemo(() => {
    if (history.length === 0) return null;
    const sorted = [...history].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    );
    const bucket = new Map();
    sorted.forEach((row) => {
      const d = new Date(row.timestamp);
      const key = d.toISOString().slice(0, 10);
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key).push(row);
    });
    const labels = [];
    const stressSeries = [];
    const negSeries = [];

    Array.from(bucket.keys())
      .sort()
      .forEach((day) => {
        const rows = bucket.get(day);
        labels.push(day.slice(5));
        const avgStress =
          rows.reduce((sum, row) => sum + estimateRowStress(row), 0) /
          rows.length;
        const negRatio =
          rows.filter((r) => NEGATIVE.includes(r.fused_emotion)).length /
          rows.length;
        stressSeries.push(Number(avgStress.toFixed(3)));
        negSeries.push(Number(negRatio.toFixed(3)));
      });

    return {
      labels,
      datasets: [
        {
          label: "Stress Trend",
          data: stressSeries,
          borderColor: "#E11D48",
          backgroundColor: "rgba(225,29,72,0.18)",
          tension: 0.35,
          fill: true,
          pointRadius: 2,
        },
        {
          label: "Negative Emotion Ratio",
          data: negSeries,
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59,130,246,0.12)",
          tension: 0.35,
          fill: false,
          pointRadius: 2,
        },
      ],
    };
  }, [history, estimateRowStress]);

  const summary = useMemo(() => {
    const ems = filtered.map((r) => r.fused_emotion);
    if (!ems.length) return null;
    const pos = ems.filter((e) => POSITIVE.includes(e)).length;
    const neg = ems.filter((e) => NEGATIVE.includes(e)).length;
    const posRatio = pos / ems.length;
    return { total: ems.length, pos, neg, posRatio };
  }, [filtered]);

  const stressMetrics = useMemo(() => {
    if (!filtered.length) return null;

    const withStress = filtered.map((row) => ({
      ...row,
      derivedStress: estimateRowStress(row),
    }));

    const avgStress =
      withStress.reduce((sum, row) => sum + row.derivedStress, 0) /
      withStress.length;
    const sortedChrono = [...withStress].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    );
    const split = Math.max(1, Math.floor(sortedChrono.length / 2));
    const firstHalf = sortedChrono.slice(0, split);
    const secondHalf = sortedChrono.slice(split);
    const firstAvg =
      firstHalf.reduce((sum, row) => sum + row.derivedStress, 0) /
      firstHalf.length;
    const secondAvg = secondHalf.length
      ? secondHalf.reduce((sum, row) => sum + row.derivedStress, 0) /
        secondHalf.length
      : firstAvg;
    const trendDelta = secondAvg - firstAvg;

    const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      values: [],
    }));
    const dayBuckets = {};

    withStress.forEach((row) => {
      const timestamp = new Date(row.timestamp);
      hourBuckets[timestamp.getHours()].values.push(row.derivedStress);
      const dayKey = timestamp.toLocaleDateString();
      if (!dayBuckets[dayKey]) dayBuckets[dayKey] = [];
      dayBuckets[dayKey].push(row.derivedStress);
    });

    const peakHourEntry =
      hourBuckets
        .filter(({ values }) => values.length > 0)
        .map(({ hour, values }) => ({
          hour,
          avg: values.reduce((sum, value) => sum + value, 0) / values.length,
        }))
        .sort((a, b) => b.avg - a.avg)[0] || null;

    const peakDayEntry =
      Object.entries(dayBuckets)
        .map(([day, values]) => ({
          day,
          avg: values.reduce((sum, value) => sum + value, 0) / values.length,
        }))
        .sort((a, b) => b.avg - a.avg)[0] || null;

    const dayTrend = Object.entries(dayBuckets)
      .map(([day, values]) => ({
        day,
        avg: values.reduce((sum, value) => sum + value, 0) / values.length,
      }))
      .sort((a, b) => new Date(a.day) - new Date(b.day));

    return {
      avgStress,
      trendDelta,
      peakHourEntry,
      peakDayEntry,
      dayTrend,
    };
  }, [filtered, estimateRowStress]);

  const cacheKey = `${range}_${new Date().toISOString().slice(0, 10)}`;

  useEffect(() => {
    const loadCached = async () => {
      if (ipc) {
        const cached = await ipc.invoke("load-analysis", cacheKey);
        if (cached) {
          setAnalysisText(cached.text);
          setAnalysisDate(cached.date);
          logInfo("history", "loaded cached analysis", { cacheKey });
        } else {
          setAnalysisText("");
          setAnalysisDate(null);
        }
      }
    };
    loadCached();
  }, [cacheKey]);

  const handleAnalyze = async () => {
    if (!filtered.length || analyzing) return;
    setAnalyzing(true);
    logInfo("history", "run cognitive analysis start", {
      range,
      rows: filtered.length,
    });
    try {
      const { data } = await axios.post(
        "/analyze_history",
        {
          history: filtered.slice(0, 500),
          groq_api_key: groqApiKey,
        },
      );
      const result = {
        text: data.analysis,
        date: new Date().toLocaleString(),
        range,
      };
      setAnalysisText(result.text);
      setAnalysisDate(result.date);

      if (ipc) await ipc.invoke("save-analysis", cacheKey, result);
      logInfo("history", "run cognitive analysis complete", { range });
    } catch (e) {
      setAnalysisText(
        "Analysis failed. Ensure the backend is running and your API key is configured.",
      );
      logError("history", "run cognitive analysis failed", {
        range,
        error: e.message,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        Loading your history...
      </div>
    );

  return (
    <div className="space-y-8 animate-fade-up pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-primary">History</h1>
          <p className="text-sm text-text-muted mt-1">
            Review your emotional and stress patterns over time.
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing || !filtered.length}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-primary/40 text-primary text-sm font-bold hover:bg-primary/5 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {analyzing ? (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {range === "all"
            ? analysisDate
              ? "Refresh All-Time Cognitive Analysis"
              : "Run All-Time Cognitive Analysis"
            : analysisDate
              ? "Refresh Analysis"
              : "Run Analysis"}
        </button>
      </div>

      <div className="inline-flex bg-surface-raised rounded-xl p-1 gap-1 border border-border-subtle">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              range === r.id
                ? "bg-primary text-white shadow"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="panel p-4 text-center">
            <p className="text-2xl font-black text-text-primary">
              {summary.total}
            </p>
            <p className="text-xs text-text-muted mt-1 font-medium">
              Total Readings
            </p>
          </div>
          <div className="panel p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <p className="text-2xl font-black text-green-600">
                {summary.pos}
              </p>
            </div>
            <p className="text-xs text-text-muted font-medium">
              Positive States
            </p>
          </div>
          <div className="panel p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <p className="text-2xl font-black text-red-500">{summary.neg}</p>
            </div>
            <p className="text-xs text-text-muted font-medium">
              High Stress Signals
            </p>
          </div>
        </div>
      )}

      {stressMetrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="panel p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                Average Stress
              </span>
            </div>
            <p className="text-2xl font-black text-text-primary">
              {Math.round(stressMetrics.avgStress * 100)}%
            </p>
            <p className="text-xs text-text-muted mt-1">
              Estimated support score across this range.
            </p>
          </div>

          <div className="panel p-4">
            <div className="flex items-center gap-2 mb-2">
              {stressMetrics.trendDelta <= 0 ? (
                <TrendingDown className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingUp className="w-4 h-4 text-red-500" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                Trend Shift
              </span>
            </div>
            <p
              className={`text-2xl font-black ${stressMetrics.trendDelta <= 0 ? "text-green-600" : "text-red-500"}`}
            >
              {stressMetrics.trendDelta <= 0 ? "Easing" : "Rising"}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {Math.abs(Math.round(stressMetrics.trendDelta * 100))}% change
              from earlier to later readings.
            </p>
          </div>

          <div className="panel p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                {isTodayRange ? "Peak Hour" : "Peak Day"}
              </span>
            </div>
            <p className="text-2xl font-black text-text-primary">
              {isTodayRange
                ? stressMetrics.peakHourEntry
                  ? `${stressMetrics.peakHourEntry.hour}:00`
                  : "—"
                : stressMetrics.peakDayEntry
                  ? stressMetrics.peakDayEntry.day
                  : "—"}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {isTodayRange
                ? "Estimated highest stress window in this day."
                : "Estimated highest stress day in this selected range."}
            </p>
          </div>

          <div className="panel p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                {isTodayRange ? "Readings Span" : "Tracked Days"}
              </span>
            </div>
            <p className="text-lg font-black text-text-primary truncate">
              {isTodayRange
                ? `${filtered.length} entries`
                : `${stressMetrics.dayTrend.length} day(s)`}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {isTodayRange
                ? "Hourly analysis is only shown for today."
                : "Weekly, monthly, and all-time views are summarized day by day."}
            </p>
          </div>
        </div>
      )}

      {summary && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium ${
            summary.posRatio >= 0.6
              ? "bg-green-50 border-green-200 text-green-700"
              : summary.posRatio <= 0.3
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
          }`}
        >
          {summary.posRatio >= 0.6 && (
            <>
              Great work. {Math.round(summary.posRatio * 100)}% of your readings
              show calmer or positive states. Keep this rhythm going.
            </>
          )}
          {summary.posRatio <= 0.3 && (
            <>
              High stress signals showed up in this period. You are not alone.
              Try short breaks, hydration, and stepping away from the screen for
              a few minutes.
            </>
          )}
          {summary.posRatio > 0.3 && summary.posRatio < 0.6 && (
            <>
              Mixed emotional patterns appeared in this period. Small workday
              habits can still lower stress over time.
            </>
          )}
        </div>
      )}

      {(range === "week" || range === "month") && periodBoxes.length > 0 && (
        <div className="panel p-6">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-5 flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-primary" />
            {range === "week"
              ? "Weekly View (7 Days)"
              : `Monthly View (${periodBoxes.length} Days)`}
          </h2>
          <div
            className={`grid gap-2 ${range === "week" ? "grid-cols-7" : "grid-cols-7 sm:grid-cols-10 md:grid-cols-12"}`}
          >
            {periodBoxes.map((box) => {
              const color = box.dominantEmotion
                ? EMOTION_COLORS[box.dominantEmotion]
                : "var(--color-surface-raised)";
              return (
                <div
                  key={box.key}
                  className="rounded-lg border border-border-subtle p-2 bg-surface-base"
                >
                  <div className="text-[10px] text-text-muted mb-1">
                    {box.label}
                  </div>
                  <div
                    className="h-8 rounded-md"
                    style={{
                      backgroundColor: box.rows.length
                        ? `${color}44`
                        : "var(--color-surface-raised)",
                    }}
                  />
                  <div className="mt-1 text-[10px] text-text-secondary truncate capitalize">
                    {box.dominantEmotion || "No data"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {range === "all" && allTimeTrend && (
        <div className="panel p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-5 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              All-Time Temporal Trend
            </h2>
            <div className="h-[320px]">
              <Line
                data={allTimeTrend}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: "index", intersect: false },
                  scales: {
                    y: {
                      min: 0,
                      max: 1,
                      ticks: { callback: (v) => `${Math.round(v * 100)}%` },
                    },
                  },
                }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">
                  Cognitive Analysis Till Now
                </h3>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={analyzing || !filtered.length}
                className="px-4 py-2 rounded-lg border border-primary/40 text-primary text-xs font-bold hover:bg-primary/5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {analysisDate ? "Refresh" : "Run Now"}
              </button>
            </div>
            {analysisText ? (
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {analysisText}
              </p>
            ) : (
              <p className="text-sm text-text-muted">
                Run this to get a cognitive summary of all recorded sessions so
                far.
              </p>
            )}
            {analysisDate && (
              <p className="text-[11px] text-text-muted mt-3">
                Generated {analysisDate}
              </p>
            )}
          </div>
        </div>
      )}

      {filtered.length > 0 && isTodayRange ? (
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
                      backgroundColor: color
                        ? `${color}33`
                        : "var(--color-surface-raised)",
                      borderColor: color ? `${color}66` : undefined,
                    }}
                  />
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1.5 px-2 py-1 bg-text-primary text-white text-[10px] rounded-md whitespace-nowrap z-20 shadow-lg">
                    {hour}:00 — {em ? em : "no data"}{" "}
                    {entries.length > 0 && `(${entries.length})`}
                  </div>
                  <p className="text-[9px] text-text-muted text-center mt-1 leading-none">
                    {hour}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            {EMOTIONS.map((e) => (
              <div
                key={e}
                className="flex items-center gap-1.5 text-[10px] text-text-secondary"
              >
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: EMOTION_COLORS[e] }}
                />
                <span className="capitalize">{e}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        !filtered.length && (
          <div className="panel p-12 text-center">
            <CalendarRange className="w-12 h-12 text-text-muted/30 mx-auto mb-3" />
            <p className="text-sm text-text-muted">
              No readings for this period yet.
            </p>
            <p className="text-xs text-text-muted mt-1">
              Enable Auto Mode to start background monitoring.
            </p>
          </div>
        )
      )}

      {stressMetrics && stressMetrics.dayTrend.length > 0 && (
        <div className="panel p-6">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Estimated Stress by Day
          </h2>
          <div className="space-y-3">
            {stressMetrics.dayTrend.slice(-7).map((entry) => (
              <div key={entry.day} className="flex items-center gap-4">
                <div className="w-24 text-xs font-medium text-text-secondary shrink-0">
                  {entry.day}
                </div>
                <div className="flex-1 h-3 rounded-full bg-surface-raised border border-border-subtle overflow-hidden">
                  <div
                    className={`h-full rounded-full ${entry.avg > 0.65 ? "bg-red-500" : entry.avg > 0.35 ? "bg-amber-500" : "bg-green-500"}`}
                    style={{ width: `${Math.round(entry.avg * 100)}%` }}
                  />
                </div>
                <div className="w-12 text-right text-xs font-bold text-text-primary shrink-0">
                  {Math.round(entry.avg * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysisText && range !== "all" && (
        <div className="panel p-6 border border-primary/20 bg-primary/5 animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">
              AI Summary over the Time Period
            </h3>
            {analysisDate && (
              <span className="ml-auto text-[10px] text-text-muted">
                Generated {analysisDate}
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {analysisText}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle">
            <h2 className="text-sm font-bold text-text-primary">
              Raw Readings
            </h2>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-raised border-b border-border-subtle sticky top-0">
                <tr>
                  <th className="px-5 py-3 font-bold text-text-secondary uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-5 py-3 font-bold text-text-secondary uppercase tracking-wider">
                    Record Start
                  </th>
                  <th className="px-5 py-3 font-bold text-text-secondary uppercase tracking-wider">
                    Record End
                  </th>
                  <th className="px-5 py-3 font-bold text-text-secondary uppercase tracking-wider">
                    Emotion
                  </th>
                  <th className="px-5 py-3 font-bold text-text-secondary uppercase tracking-wider hidden sm:table-cell">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((row, i) => (
                  <tr
                    key={i}
                    className="hover:bg-surface-raised/60 transition-colors"
                  >
                    <td className="px-5 py-3 text-text-muted font-mono whitespace-nowrap">
                      {new Date(row.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-text-muted font-mono whitespace-nowrap">
                      {row.recording_started_at
                        ? new Date(
                            row.recording_started_at,
                          ).toLocaleTimeString()
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-text-muted font-mono whitespace-nowrap">
                      {row.recording_ended_at
                        ? new Date(row.recording_ended_at).toLocaleTimeString()
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="font-bold capitalize"
                        style={{
                          color: EMOTION_COLORS[row.fused_emotion] || "inherit",
                        }}
                      >
                        {row.fused_emotion || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-text-muted max-w-xs truncate hidden sm:table-cell">
                      {row.reasoning}
                    </td>
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
