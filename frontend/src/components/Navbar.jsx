import { Brain } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-card-border/30">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
        <Brain className="w-6 h-6 text-rajah animate-float" strokeWidth={2} />
        <span className="text-lg font-semibold tracking-tight text-text-primary">
          Emotion<span className="text-rajah">AI</span>
        </span>
        <span className="ml-2 text-xs font-medium text-text-muted bg-bluewood-light/40 px-2 py-0.5 rounded-full">
          Multimodal Analysis
        </span>
      </div>
    </nav>
  );
}
