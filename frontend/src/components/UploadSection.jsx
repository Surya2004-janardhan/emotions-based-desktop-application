import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileVideo, Activity } from 'lucide-react';

const UploadSection = ({ onFileSelect, isProcessing }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-24 relative">
      <div className="glow-orb -top-20 -left-20 opacity-30" />
      <div className="glow-orb -bottom-20 -right-20 opacity-20" />

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`upload-zone relative flex flex-col items-center justify-center p-16 h-[400px] border-2 transition-all cursor-pointer overflow-hidden
          ${dragActive ? 'border-white/50 bg-white/5' : 'border-white/10 bg-white/[0.01] hover:bg-white/[0.03]'}
          ${isProcessing ? 'pointer-events-none opacity-40 grayscale' : ''}
        `}
        onClick={() => !isProcessing && document.getElementById("file-upload").click()}
      >
        <input 
          id="file-upload" 
          type="file" 
          className="hidden" 
          accept="video/*" 
          onChange={handleFileChange}
        />

        <div className="relative z-10 flex flex-col items-center gap-10">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
             <Upload className="w-8 h-8 text-white/40" />
          </div>
          
          <div className="flex flex-col items-center gap-3 text-center">
             <h3 className="text-3xl font-extrabold tracking-tight">Upload Media</h3>
             <p className="text-sm font-bold text-white/30 tracking-widest uppercase">Video data ingestion for spectral analysis</p>
          </div>

          <div className="flex items-center gap-6 pt-4 text-[10px] font-bold uppercase tracking-[0.3em] opacity-30">
             <div className="flex items-center gap-2">
                <FileVideo className="w-3.5 h-3.5" /> MP4/WEBM
             </div>
             <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
             <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" /> 11s MAX
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UploadSection;
