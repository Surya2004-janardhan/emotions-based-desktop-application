import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Sparkles, Trash2 } from 'lucide-react';
import axios from 'axios';

const CHAT_MEMORY_KEY = 'emotionai_chat_memory_v1';
const DEFAULT_MESSAGE = {
  role: 'assistant',
  content: 'I am your personal stress support assistant. I remember our conversation and can explain your emotional trends across your previous runs in simple English.'
};

export default function Chatbot({ results, isOpen, onClose }) {
  const [messages, setMessages] = useState([DEFAULT_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const endRef = useRef(null);
  const ipc = typeof window !== 'undefined' && window.require
    ? window.require('electron').ipcRenderer
    : null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_MEMORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed);
      }
    } catch {
      // Ignore broken local cache
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_MEMORY_KEY, JSON.stringify(messages));
    } catch {
      // Ignore local storage failures
    }
  }, [messages]);

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      try {
        if (ipc) {
          const data = await ipc.invoke('load-results');
          if (active) setAnalysisHistory(Array.isArray(data) ? data.slice(0, 500) : []);
          return;
        }

        const res = await axios.get('/history?limit=500');
        if (active) setAnalysisHistory(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (active) setAnalysisHistory([]);
      }
    };

    loadHistory();
    return () => {
      active = false;
    };
  }, [ipc, results]);

  const send = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const history = updated
        .filter((m, i) => i > 0)
        .slice(-80);

      const res = await axios.post('/chat', {
        message: userMsg.content,
        context: results || {},
        history,
        analysis_history: analysisHistory,
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply || 'No response.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Communication error — unable to reach neural core.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearMemory = () => {
    setMessages([DEFAULT_MESSAGE]);
    setInput('');
    try {
      localStorage.removeItem(CHAT_MEMORY_KEY);
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-up">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative m-4 sm:m-6 w-full h-[calc(100vh-2rem)] sm:h-[calc(100vh-3rem)] bg-surface-base border border-border-subtle rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-raised/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">AI Counselor</span>
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Personal Stress AI · Full Context Mode</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearMemory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-text-primary hover:bg-surface-base transition-all cursor-pointer"
              title="Clear assistant memory"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Memory
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-bg-base font-medium'
                    : 'bg-surface-raised border border-border-subtle text-text-secondary'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface-raised border border-border-subtle rounded-xl px-4 py-2.5 text-xs text-text-muted flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                <span>Thinking using your full history and conversation memory...</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-surface-raised/30 border-t border-border-subtle shrink-0">
          <div className="flex items-center gap-3 bg-surface-base border border-border-subtle rounded-xl px-4 py-2.5 transition-all focus-within:border-primary/50 group">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your emotional shifts, stress trends, or what changed across previous runs..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 outline-none"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="text-primary disabled:opacity-20 hover:scale-110 active:scale-95 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
