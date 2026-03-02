import { Sparkles, BookOpen, Quote, Youtube, Music } from 'lucide-react';

export default function AIContent({ results }) {
  if (!results) return null;
  const { story, quote, video, songs } = results;

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-up" style={{ animationDelay: '0.25s' }}>
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-wattle" />
        AI Recommendations Engine
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {story && (
          <div className="glass glow-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-wattle">
              <BookOpen className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Your Story</span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{story}</p>
          </div>
        )}

        {quote && (
          <div className="glass glow-border rounded-2xl p-5 space-y-3 flex flex-col justify-center">
            <Quote className="w-6 h-6 text-wattle/40" />
            <blockquote className="text-sm text-text-primary italic leading-relaxed pl-3" style={{ borderLeft: '2px solid rgba(213,207,47,0.25)' }}>
              {quote}
            </blockquote>
          </div>
        )}

        {video && (
          <div className="glass glow-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-wattle">
              <Youtube className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Watch This</span>
            </div>
            {typeof video === 'string' ? (
              <a
                href={video.match(/https?:\/\/[^\s"]+/)?.[0] || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-wattle-light hover:text-wattle transition-colors underline underline-offset-2 break-all"
              >
                {video}
              </a>
            ) : (
              <p className="text-sm text-text-secondary">{JSON.stringify(video)}</p>
            )}
          </div>
        )}

        {songs && songs.length > 0 && (
          <div className="glass glow-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-wattle">
              <Music className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Playlist</span>
            </div>
            <div className="space-y-3">
              {songs.map((song, i) => (
                <div key={i} className="flex items-start gap-3 group">
                  <span className="text-xs text-text-muted font-bold mt-0.5 w-4 shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary font-medium truncate">
                      {song.title || 'Unknown'}{' '}
                      <span className="text-text-muted font-normal">— {song.artist || 'Unknown'}</span>
                    </p>
                    {song.explanation && <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{song.explanation}</p>}
                    {song.link && (
                      <a href={song.link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-wattle/70 hover:text-wattle transition-colors">
                        Listen →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
