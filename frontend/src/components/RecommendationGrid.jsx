import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Play, Music, Youtube } from 'lucide-react';

const RecommendationGrid = ({ songs, video }) => {
  return (
    <div className="flex flex-col gap-12 w-full max-w-5xl mx-auto py-16 px-10 glass-panel etched-corners">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase font-bold tracking-[0.5em] text-amber-400/50">Curated Content Feed</span>
        <h3 className="text-3xl font-extrabold tracking-tight gradient-text-warm">Discovery Grid</h3>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
        {/* Songs Column */}
        <div className="space-y-6">
          <span className="text-[10px] uppercase font-bold text-cyan-400/30 tracking-[0.3em] block">
            Audio Resonance
          </span>
          <div className="space-y-4">
            {songs?.length > 0 ? (
              songs.map((song, i) => (
                <motion.a
                  key={i}
                  href={song.link}
                  target="_blank"
                  rel="noreferrer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="block p-5 glass-card group relative overflow-hidden"
                >
                  {/* Hover glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 to-violet-500/0 group-hover:from-cyan-500/5 group-hover:to-violet-500/5 transition-all duration-500 rounded-2xl" />

                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-5">
                      <div className="w-11 h-11 rounded-xl border border-white/5 flex items-center justify-center bg-white/5 group-hover:bg-gradient-to-br group-hover:from-cyan-500 group-hover:to-violet-500 group-hover:border-transparent transition-all duration-500">
                        <Music className="w-4.5 h-4.5 text-white/30 group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-base font-bold text-white/85 group-hover:text-white transition-colors">{song.title}</span>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-white/25 font-semibold group-hover:text-cyan-400/60 transition-colors">{song.artist}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-all text-cyan-400 translate-x-2 group-hover:translate-x-0" />
                  </div>
                </motion.a>
              ))
            ) : (
              <div className="p-12 border border-dashed border-white/5 rounded-2xl text-center bg-white/[0.01]">
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/15">Awaiting audio synthesis</span>
              </div>
            )}
          </div>
        </div>

        {/* Video Column */}
        <div className="space-y-6">
          <span className="text-[10px] uppercase font-bold text-violet-400/30 tracking-[0.3em] block">
            Visual Guide
          </span>
          {video ? (
            <a
              href={video.link || 'https://youtube.com'}
              target="_blank"
              rel="noreferrer"
              className="block glass-card overflow-hidden group aspect-[16/11] relative"
            >
              {/* Background gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 group-hover:from-violet-500/10 group-hover:to-cyan-500/10 transition-all duration-700" />

              {/* Center Play Button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  whileHover={{ scale: 1.15 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-white/10 backdrop-blur-xl flex items-center justify-center group-hover:from-cyan-500/40 group-hover:to-violet-500/40 transition-all duration-500 glow-violet"
                >
                  <Play className="w-6 h-6 text-white fill-white/20 group-hover:fill-white/60 transition-colors" />
                </motion.div>
              </div>

              {/* Bottom Info */}
              <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-3 group-hover:translate-y-[-4px] transition-transform duration-500">
                <div className="flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-white/20 group-hover:text-red-500 transition-colors" />
                  <span className="text-[9px] uppercase tracking-[0.3em] font-bold text-white/15 group-hover:text-white/40 transition-colors">Visual Stream</span>
                </div>
                <h5 className="text-lg font-bold tracking-tight text-white/80 leading-snug group-hover:text-white transition-colors">
                  {video.title || "Reflective Guide Sequence"}
                </h5>
              </div>
            </a>
          ) : (
            <div className="aspect-[16/11] border border-dashed border-white/5 rounded-2xl flex items-center justify-center bg-white/[0.01]">
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/15">Spectral data pending</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecommendationGrid;
