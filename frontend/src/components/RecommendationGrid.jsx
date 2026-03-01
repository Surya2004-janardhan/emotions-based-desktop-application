import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Play, Music, Youtube } from 'lucide-react';

const RecommendationGrid = ({ songs, video }) => {
  return (
    <div className="flex flex-col gap-16 w-full max-w-5xl mx-auto py-32 px-12 glass-surface mt-32 border-t-white/10">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase font-bold tracking-[0.6em] text-white/30">Curyated Content Feed</span>
        <h3 className="text-4xl font-extrabold tracking-tight text-white">Discovery Grid</h3>
      </div>

      <div className="grid lg:grid-cols-2 gap-16 items-start">
        {/* Songs Column */}
        <div className="space-y-8">
          <span className="text-[11px] uppercase font-extrabold text-white/10 tracking-widest block italic">Audio Resonance</span>
          <div className="space-y-6">
            {songs?.length > 0 ? (
              songs.map((song, i) => (
                <a
                  key={i}
                  href={song.link}
                  target="_blank"
                  rel="noreferrer"
                  className="block p-8 border border-white/5 rounded-3xl hover:border-white/30 transition-all group glass-card relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                      <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center bg-white/5 group-hover:scale-110 group-hover:bg-white group-hover:border-white transition-all duration-500">
                        <Music className="w-5 h-5 text-white/20 group-hover:text-black transition-colors" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-lg font-bold text-white/90 group-hover:underline">{song.title}</span>
                        <span className="text-[12px] uppercase tracking-[0.3em] text-white/30 font-bold group-hover:text-white/60 transition-colors">{song.artist}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all text-white/40" />
                  </div>
                </a>
              ))
            ) : (
              <div className="p-16 border-2 border-dashed border-white/5 rounded-3xl text-center bg-white/[0.01]">
                <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/20">Awaiting audio synthesis</span>
              </div>
            )}
          </div>
        </div>

        {/* Video Column */}
        <div className="space-y-8">
          <span className="text-[11px] uppercase font-extrabold text-white/10 tracking-widest block italic">Visual Resonance Guide</span>
          {video ? (
            <a
              href={video.link || 'https://youtube.com'}
              target="_blank"
              rel="noreferrer"
              className="block glass-surface border-white/10 rounded-3xl overflow-hidden group hover:border-white/40 transition-all aspect-[16/11] relative shadow-2xl"
            >
               <div className="absolute inset-0 bg-white/[0.02]" />
               
               {/* Minimal Center Icon */}
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-20 h-20 rounded-full border border-white/5 bg-white/5 backdrop-blur-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-3xl">
                   <Play className="w-7 h-7 text-white fill-white/10 group-hover:fill-white transition-colors" />
                 </div>
               </div>
               
               {/* Details Bottom Overlay */}
               <div className="absolute bottom-10 left-10 right-10 flex flex-col gap-4 group-hover:translate-y-[-6px] transition-transform">
                 <div className="flex items-center gap-3">
                   <Youtube className="w-5 h-5 text-white/30 group-hover:text-red-600 transition-colors" />
                   <span className="text-[10px] uppercase tracking-widest font-black text-white/20 group-hover:text-white/60 transition-colors">Visual Stream Ingestion</span>
                 </div>
                 <h5 className="text-2xl font-black tracking-tight text-white leading-tight italic underline decoration-white/10 underline-offset-8 group-hover:decoration-white transition-all duration-700">
                   {video.title || "Reflective Guide Sequence"}
                 </h5>
               </div>
            </a>
          ) : (
             <div className="aspect-[16/11] border-2 border-dashed border-white/5 rounded-3xl flex items-center justify-center bg-white/[0.01]">
                <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/20">Spectral data pending</span>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecommendationGrid;
