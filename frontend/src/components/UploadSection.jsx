import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, Zap } from 'lucide-react';

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
    <div className="w-full max-w-4xl mx-auto relative group">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`upload-zone relative flex flex-col items-center justify-center p-16 h-[380px] cursor-pointer
          ${dragActive ? 'bg-violet-500/10 scale-[1.01]' : ''}
          ${isProcessing ? 'pointer-events-none opacity-30' : ''}
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

        {/* Background decorative circles */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-3xl">
          <div className="w-[500px] h-[500px] border border-cyan-500/5 rounded-full animate-pulse" />
          <div className="absolute w-[350px] h-[350px] border border-violet-500/5 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute w-[200px] h-[200px] border border-rose-500/5 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8">
          {/* Upload Icon Circle */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="relative"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-violet-500/15 border border-cyan-500/20 flex items-center justify-center group-hover:from-cyan-500/25 group-hover:to-violet-500/25 group-hover:border-cyan-500/40 transition-all duration-700">
              <Upload className="w-8 h-8 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center animate-pulse-glow">
              <Zap className="w-3 h-3 text-white" />
            </div>
          </motion.div>

          {/* Text */}
          <div className="flex flex-col items-center gap-3 text-center">
            <h3 className="text-3xl font-extrabold tracking-tight gradient-text">
              Drop Your Video
            </h3>
            <p className="text-sm text-white/30 max-w-xs">
              Drag & drop a video file or click to browse
            </p>
          </div>

          {/* Supported formats */}
          <div className="flex items-center gap-4 mt-2">
            {['MP4', 'MOV', 'WEBM'].map((fmt) => (
              <span key={fmt} className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/15 px-3 py-1 rounded-full border border-white/5">
                {fmt}
              </span>
            ))}
          </div>
        </div>

        {/* Corner metadata */}
        <div className="absolute bottom-6 left-6 flex items-center gap-2 opacity-[0.08]">
          <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
          <span className="text-[8px] font-bold tracking-widest uppercase text-cyan-300">Select media file</span>
        </div>
        <div className="absolute bottom-6 right-6 flex items-center gap-2 opacity-[0.08]">
          <span className="text-[8px] font-bold tracking-widest uppercase text-violet-300">Limit: 11s / 60MB</span>
        </div>
      </motion.div>
    </div>
  );
};

export default UploadSection;
