import { Brain, MessageCircle, Activity, Clock } from 'lucide-react';

export default function Navbar({ chatOpen, onToggleChat, isDaemonActive, onToggleDaemon, daemonIntervalMinutes, setDaemonIntervalMinutes }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-border-subtle rounded-none">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-primary animate-fade-up" strokeWidth={2} />
          <span className="text-lg font-semibold tracking-tight text-text-primary">
            Emotion<span className="text-primary">AI</span>
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-2 hidden sm:flex">
             <span className="text-[11px] font-medium text-text-secondary leading-none">Team Project</span>
             <span className="text-[10px] text-text-muted mt-0.5">D7 • Final Year</span>
          </div>

          <div className="flex items-center gap-2 border-l border-border-subtle pl-4 ml-2">
            <div className="flex items-center gap-1 bg-surface-raised px-2 py-1 rounded-lg border border-border-subtle mr-2 h-9">
              <Clock className="w-4 h-4 text-text-muted" />
              <select 
                value={daemonIntervalMinutes} 
                onChange={(e) => setDaemonIntervalMinutes(Number(e.target.value))}
                disabled={isDaemonActive}
                className="bg-transparent text-xs font-bold text-text-secondary outline-none cursor-pointer disabled:opacity-50"
                title="Minutes between 5-minute sessions"
              >
                <option value={15}>15m</option>
                <option value={30}>30m</option>
                <option value={45}>45m</option>
                <option value={60}>60m</option>
              </select>
            </div>

            <button
              onClick={onToggleDaemon}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-bold uppercase tracking-wider h-9 ${
                isDaemonActive 
                  ? 'bg-green-500/20 text-green-700 border border-green-500/30' 
                  : 'bg-surface-raised text-text-secondary hover:text-text-primary border border-transparent'
              }`}
              title="Toggle Passive Background Daemon"
            >
              <Activity className={`w-4 h-4 ${isDaemonActive ? 'animate-pulse' : ''}`} />
              {isDaemonActive ? 'Daemon Active' : 'Daemon Off'}
            </button>
            <button
              onClick={onToggleChat}
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                chatOpen 
                  ? 'bg-primary/20 text-primary' 
                  : 'text-text-secondary hover:bg-surface-raised hover:text-primary'
              }`}
              title="Toggle Chat"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
