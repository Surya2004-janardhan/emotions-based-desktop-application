/**
 * useSettings — Persistent app settings via Electron IPC (userData/settings.json)
 * Falls back to sane defaults in browser/non-Electron environments.
 */
import { useState, useEffect, useCallback } from 'react';

const DEFAULT_SETTINGS = {
  autoMode: false,
  intervalMinutes: 15,
  recordDurationMinutes: 5,
  notifyPermission: 'ask',   // 'ask' | 'auto'
  musicMappings: {},         // { emotion: absoluteFilePath }
};

// Check if we're inside Electron with IPC available
const ipc = typeof window !== 'undefined' && window.require
  ? window.require('electron').ipcRenderer
  : null;

export default function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Load on mount
  useEffect(() => {
    const load = async () => {
      if (ipc) {
        const saved = await ipc.invoke('load-settings');
        setSettings({ ...DEFAULT_SETTINGS, ...saved });
      }
      setLoaded(true);
    };
    load();
  }, []);

  // Save whenever settings change (after initial load)
  const save = useCallback(async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (ipc) {
      await ipc.invoke('save-settings', next);
    }
    return next;
  }, [settings]);

  // Convenience: save a single music mapping
  const saveMusicMapping = useCallback(async (emotion, filePath) => {
    const next = {
      ...settings,
      musicMappings: { ...settings.musicMappings, [emotion]: filePath }
    };
    setSettings(next);
    if (ipc) await ipc.invoke('save-settings', next);
  }, [settings]);

  // Convenience: save to Flask SQLite too (keeps both in sync)
  const syncMappingToBackend = useCallback(async (emotion, filePath) => {
    try {
      const axios = await import('axios');
      await axios.default.post('/mappings', { emotion, music_path: filePath });
    } catch(e) {
      console.warn('Failed to sync mapping to backend:', e);
    }
  }, []);

  return {
    settings,
    loaded,
    save,
    saveMusicMapping: async (emotion, filePath) => {
      await saveMusicMapping(emotion, filePath);
      await syncMappingToBackend(emotion, filePath);
    },
  };
}
