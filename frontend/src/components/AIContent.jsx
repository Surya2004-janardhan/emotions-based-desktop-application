import { useState, useRef, useEffect } from 'react';
import { Sparkles, BookOpen, Quote, Play, Pause, Music, BookMarked, ExternalLink, Youtube } from 'lucide-react';
import axios from 'axios';

/* ── YouTube embed helper ─────────────────────────────── */
function extractYTId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function YouTubeEmbed({ url, title }) {
  const id = extractYTId(url);
  if (!id) return null;
  return (
    <div className="rounded-lg overflow-hidden border border-border-subtle" style={{ aspectRatio: '16/9' }}>
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title={title || 'YouTube video'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full border-0"
      />
    </div>
  );
}

/* ── Dynamic Song Player ───────────────────────────────── */
function SongPlayer({ artist, title }) {
  const [track, setTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

  const initPlayback = async () => {
    if (track) { togglePlay(); return; }
    setLoading(true);
    try {
      const q = `${artist} ${title}`.trim();
      const res = await axios.get(`/music/search?q=${encodeURIComponent(q)}`);
      if (res.data.preview) {
        setTrack(res.data);
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.src = res.data.preview;
            audioRef.current.play();
            setPlaying(true);
          }
        }, 100);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
    const onEnd = () => { setPlaying(false); setProgress(0); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnd); };
  }, [track]);

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl bg-surface-base border border-border-subtle hover:border-primary/30 transition-all group">
      <button
        onClick={initPlayback}
        disabled={loading}
        className="relative w-12 h-12 rounded-lg shrink-0 flex items-center justify-center overflow-hidden cursor-pointer bg-surface-raised transition-transform active:scale-95"
        style={{ background: track?.album_art ? `url(${track.album_art}) center/cover` : '' }}
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${track?.album_art ? 'bg-white/40 opacity-0 group-hover:opacity-100' : ''} transition-opacity`}>
            {playing ? <Pause className="w-5 h-5 text-primary fill-primary" /> : <Play className="w-5 h-5 text-primary fill-primary" />}
          </div>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary font-bold truncate">{title}</p>
        <p className="text-[11px] text-text-secondary truncate mb-2">{artist}</p>
        {track && (
          <div className="h-1 rounded-full bg-surface-raised overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <audio ref={audioRef} />
    </div>
  );
}

/* ── Main component ───────────────────────────────────── */
export default function AIContent({ results }) {
  if (!results) return null;
  const { story, quote, video, books, songs } = results;

  const videoObj = typeof video === 'object' && video !== null ? video : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
           <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">AI Recommendation Engine</h3>
          <p className="text-[10px] text-text-muted font-semibold uppercase tracking-tighter">AI-Synthesized Neural Arc</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Story Section */}
        {story && (
          <div className="lg:col-span-12 xl:col-span-8 panel p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <BookOpen className="w-24 h-24" />
            </div>
            <div className="flex items-center gap-2 text-primary relative z-10">
              <BookOpen className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Temporal Narrative</span>
            </div>
            <p className="text-[15px] text-text-secondary leading-relaxed first-letter:text-4xl first-letter:font-bold first-letter:text-primary first-letter:mr-2 first-letter:float-left relative z-10">
              {story}
            </p>
          </div>
        )}

        {/* Quote Section */}
        {quote && (
          <div className="lg:col-span-6 xl:col-span-4 panel p-8 flex flex-col justify-center bg-primary/5 border-primary/20">
            <Quote className="w-10 h-10 text-primary/10 mb-6" />
            <blockquote className="text-lg text-primary font-medium italic leading-snug">
              "{quote}"
            </blockquote>
          </div>
        )}

        {/* Video Recommendation */}
        {videoObj && (
          <div className="lg:col-span-6 xl:col-span-5 panel p-6 space-y-5">
            <div className="flex items-center gap-2 text-primary">
              <Youtube className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Dynamic Visual Anchor</span>
            </div>
            
            {extractYTId(videoObj.link) ? (
              <YouTubeEmbed url={videoObj.link} title={videoObj.title} />
            ) : (
              <a href={videoObj.link} target="_blank" rel="noopener noreferrer" className="block p-4 rounded-xl bg-surface-raised border border-border-subtle hover:border-primary/40 transition-all group">
                <Play className="w-8 h-8 text-primary mb-2 opacity-60 group-hover:opacity-100" />
                <p className="text-sm font-bold text-text-primary">Explore Transition Graph</p>
              </a>
            )}

            <div className="space-y-2">
              <p className="text-sm text-text-primary font-bold">{videoObj.title}</p>
              {videoObj.reason && <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{videoObj.reason}</p>}
            </div>
          </div>
        )}

        {/* Books Section */}
        {books && books.length > 0 && (
          <div className="lg:col-span-6 xl:col-span-7 panel p-6 space-y-5">
            <div className="flex items-center gap-2 text-primary">
              <BookMarked className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Resonance Literature</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {books.map((book, i) => (
                <div key={i} className="p-4 rounded-xl bg-surface-base border border-border-subtle flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-text-primary font-bold mb-1 truncate">{book.title}</p>
                    <p className="text-[10px] text-primary font-bold uppercase mb-3">{book.author}</p>
                    {book.reason && <p className="text-[10px] text-text-muted leading-tight line-clamp-2 mb-4">{book.reason}</p>}
                  </div>
                  {book.purchase_link && (
                    <a href={book.purchase_link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-2 rounded-lg bg-surface-raised border border-border-subtle text-[10px] font-bold text-text-primary hover:bg-primary/10 hover:border-primary/20 transition-all uppercase tracking-widest">
                      Purchase <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Songs Section */}
        {songs && songs.length > 0 && (
          <div className="lg:col-span-12 panel p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <Music className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-widest">Auditory Spectrum</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted px-2 py-1 rounded bg-surface-raised">Neural Audio Cache</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {songs.map((song, i) => (
                <SongPlayer key={i} artist={song.artist} title={song.title} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
