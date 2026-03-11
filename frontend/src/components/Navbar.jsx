import { Brain, MessageCircle } from 'lucide-react';

export default function Navbar({ chatOpen, onToggleChat }) {
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
    </nav>
  );
}
