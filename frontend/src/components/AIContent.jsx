import { Sparkles, BookOpen, Quote, Youtube, Music } from 'lucide-react';

export default function AIContent({ results }) {
  if (!results) return null;

  const { story, quote, video, songs } = results;

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-up" style={{ animationDelay: '0.25s' }}>
      {/* Section title */}
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-rajah" />
        AI Recommendations Engine
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Story Card */}
        {story && (
          <div className="glass glow-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-rajah">
              <BookOpen className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Your Story</span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{story}</p>
          </div>
        )}

        {/* Quote Card */}
        {quote && (
          <div className="glass glow-border rounded-2xl p-5 space-y-3 flex flex-col justify-center">
            <Quote className="w-6 h-6 text-rajah/40" />
            <blockquote className="text-sm text-text-primary italic leading-relaxed border-l-2 border-rajah/30 pl-3">
              {quote}
            </blockquote>
          </div>
        )}

        {/* Video Recommendation */}
        {video && (
          <div className="glass glow-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-rajah">
              <Youtube className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Watch This</span>
            </div>
            {typeof video === 'string' ? (
              <a
                href={video.match(/https?:\/\/[^\s"]+/)?.[0] || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-rajah-light hover:text-rajah transition-colors underline underline-offset-2 break-all"
              >
                {video}
              </a>
            ) : (
              <p className="text-sm text-text-secondary">{JSON.stringify(video)}</p>
            )}
          </div>
        )}

        {/* Songs */}
        {songs && songs.length > 0 && (
          <div className="glass glow-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-rajah">
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
                    {song.explanation && (
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{song.explanation}</p>
                    )}
                    {song.link && (
                      <a
                        href={song.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-rajah/70 hover:text-rajah transition-colors"
                      >
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
