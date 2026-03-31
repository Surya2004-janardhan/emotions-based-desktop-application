/**
 * useBackendUrl — resolves the correct backend URL
 * - Production (packaged Electron): returns the HF Space URL via IPC
 * - Development: returns http://127.0.0.1:5000
 */
import { useState, useEffect } from 'react';

const ipc = typeof window !== 'undefined' && window.require
  ? window.require('electron').ipcRenderer
  : null;

const FALLBACK = 'http://127.0.0.1:5000';

// Shared singleton so every hook call resolves once
let resolvedUrl = null;
let resolveCallbacks = [];

async function resolve() {
  if (resolvedUrl) return resolvedUrl;
  if (ipc) {
    try {
      resolvedUrl = await ipc.invoke('get-backend-url');
    } catch {
      resolvedUrl = FALLBACK;
    }
  } else {
    resolvedUrl = FALLBACK;
  }
  resolveCallbacks.forEach(cb => cb(resolvedUrl));
  resolveCallbacks = [];
  return resolvedUrl;
}

// Kick off resolution immediately on module load
resolve();

export default function useBackendUrl() {
  const [url, setUrl] = useState(resolvedUrl || FALLBACK);

  useEffect(() => {
    if (resolvedUrl) { setUrl(resolvedUrl); return; }
    resolveCallbacks.push(setUrl);
  }, []);

  return url;
}

// Named export for one-off use in non-component code
export { resolve as getBackendUrl };
