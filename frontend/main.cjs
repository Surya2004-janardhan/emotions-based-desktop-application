const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ─── State ────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let pythonProcess = null;
let pythonReady = false;
let pythonReadyCallbacks = [];

// ─── Paths (initialized after app ready) ─────────────────────
let USER_DATA, SETTINGS_FILE, RESULTS_FILE, ANALYSES_DIR;

function initPaths() {
  USER_DATA      = app.getPath('userData');
  SETTINGS_FILE  = path.join(USER_DATA, 'settings.json');
  RESULTS_FILE   = path.join(USER_DATA, 'results.json');
  ANALYSES_DIR   = path.join(USER_DATA, 'analyses');
  if (!fs.existsSync(ANALYSES_DIR)) fs.mkdirSync(ANALYSES_DIR, { recursive: true });
}

// ─── Default Settings ─────────────────────────────────────────
const DEFAULT_SETTINGS = {
  autoMode: false,
  intervalMinutes: 15,
  recordDurationMinutes: 5,
  notifyPermission: 'ask',   // 'ask' | 'auto'
  musicMappings: {}
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) };
    }
  } catch(e) { console.error('Settings load error:', e); }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(data) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch(e) { console.error('Settings save error:', e); return false; }
}

// ─── Flask Backend (on-demand) ────────────────────────────────
const FLASK_URL = 'http://127.0.0.1:5000';
const BACKEND_CWD = path.join(__dirname, '..');

function startBackend() {
  if (pythonProcess && !pythonProcess.killed) {
    console.log('[Backend] Already running');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    console.log('[Backend] Spawning Flask...');
    pythonReady = false;
    pythonReadyCallbacks = [];

    // Linux environments often provide `python3` instead of `python`.
    const pythonCmd = process.platform === 'win32' ? 'python' : (process.env.PYTHON_BIN || 'python3');
    pythonProcess = spawn(pythonCmd, ['app.py'], { cwd: BACKEND_CWD });

    const readyTimer = setTimeout(() => {
      // Assume ready after 8 seconds even if we miss the stdout signal
      if (!pythonReady) {
        pythonReady = true;
        pythonReadyCallbacks.forEach(cb => cb());
        pythonReadyCallbacks = [];
        resolve();
      }
    }, 8000);

    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString();
      console.log(`[Flask]: ${text}`);
      if ((text.includes('Running on') || text.includes('Serving Flask')) && !pythonReady) {
        clearTimeout(readyTimer);
        pythonReady = true;
        pythonReadyCallbacks.forEach(cb => cb());
        pythonReadyCallbacks = [];
        resolve();
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString();
      console.error(`[Flask Error]: ${text}`);
      // Flask dev server prints its "Running on" to stderr
      if ((text.includes('Running on') || text.includes('Serving Flask')) && !pythonReady) {
        clearTimeout(readyTimer);
        pythonReady = true;
        pythonReadyCallbacks.forEach(cb => cb());
        pythonReadyCallbacks = [];
        resolve();
      }
    });

    pythonProcess.on('exit', (code) => {
      console.log(`[Backend] Process exited with code ${code}`);
      pythonProcess = null;
      pythonReady = false;
    });

    pythonProcess.on('error', (err) => {
      console.error('[Backend] Failed to start:', err);
      reject(err);
    });
  });
}

function stopBackend() {
  if (pythonProcess && !pythonProcess.killed) {
    console.log('[Backend] Stopping Flask...');
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
    pythonReady = false;
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────
function setupIPC() {
  // Settings persistence
  ipcMain.handle('load-settings', () => loadSettings());

  ipcMain.handle('save-settings', (_e, data) => {
    const ok = saveSettings(data);
    return { ok };
  });

  // History (results log)
  ipcMain.handle('load-results', () => {
    try {
      if (fs.existsSync(RESULTS_FILE)) return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
    } catch(e) {}
    return [];
  });

  ipcMain.handle('save-result', (_e, result) => {
    try {
      let arr = [];
      if (fs.existsSync(RESULTS_FILE)) arr = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
      arr.unshift({ ...result, timestamp: new Date().toISOString() });
      // Keep max 500 entries
      if (arr.length > 500) arr = arr.slice(0, 500);
      fs.writeFileSync(RESULTS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
      return { ok: true };
    } catch(e) { return { ok: false, error: e.message }; }
  });

  // Per-day cached LLM analyses
  ipcMain.handle('load-analysis', (_e, dateKey) => {
    const file = path.join(ANALYSES_DIR, `${dateKey}.json`);
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch(e) {}
    return null;
  });

  ipcMain.handle('save-analysis', (_e, dateKey, data) => {
    const file = path.join(ANALYSES_DIR, `${dateKey}.json`);
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
      return { ok: true };
    } catch(e) { return { ok: false }; }
  });

  // On-demand backend control
  ipcMain.handle('start-backend', async () => {
    try { await startBackend(); return { ok: true }; }
    catch(e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('stop-backend', () => {
    stopBackend();
    return { ok: true };
  });

  ipcMain.handle('backend-status', () => ({ running: !!pythonProcess && pythonReady }));

  // Native OS Notification
  ipcMain.handle('notify-shift', (_e, { emotion, autoPlay, musicPath }) => {
    if (!Notification.isSupported()) return;

    const notif = new Notification({
      title: 'EmotionAI – Emotional Shift',
      body: autoPlay
        ? `Detected shift to ${emotion}. Playing your mapped playlist now.`
        : `Detected shift to ${emotion}. Click to play your mapped playlist.`,
      silent: false,
      urgency: 'normal',
    });

    notif.on('click', () => {
      if (musicPath) {
        shell.openPath(musicPath);
      }
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    notif.show();

    // If auto-play, open the file immediately too
    if (autoPlay && musicPath) {
      shell.openPath(musicPath);
    }

    return { ok: true };
  });

  // Show/hide window
  ipcMain.handle('show-window', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

// ─── Create Window ────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: true,   // Show immediately — tray-only means minimize-to-tray on CLOSE, not hide on open
    frame: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
    autoHideMenuBar: true,
  });

  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath) && !process.argv.includes('--dev')) {
    mainWindow.loadFile(indexPath).catch(e => console.error('[Window]', e));
  } else {
    mainWindow.loadURL('http://localhost:5173').catch(e => {
      console.error('[Window] Ensure vite dev is running:', e);
    });
  }

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  mainWindow.on('ready-to-show', () => {
    // Only show if user explicitly launches (not autostart)
    // Tray click will show the window
  });
}

// ─── System Tray ─────────────────────────────────────────────
function createTray() {
  let iconPath = path.join(__dirname, 'public', 'icon.jpg');
  if (!fs.existsSync(iconPath)) iconPath = path.join(__dirname, 'dist', 'icon.jpg');

  const trayIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(trayIcon);

  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: 'Open EmotionAI',
      click: () => { mainWindow?.show(); mainWindow?.focus(); }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { app.isQuiting = true; app.quit(); }
    },
  ]);

  tray.setToolTip('EmotionAI – Background Monitor');
  tray.setContextMenu(buildMenu());

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

// ─── App Lifecycle ────────────────────────────────────────────
app.whenReady().then(async () => {
  // Required for Windows native toast notifications to appear in Action Center
  app.setAppUserModelId('EmotionAI');

  initPaths(); // Must be first — sets up file paths

  setupIPC();
  createWindow();
  createTray();

  // Pre-warm backend in the background
  startBackend().catch(e => console.error('[App] Backend pre-warm failed:', e));
});

app.on('window-all-closed', (e) => e.preventDefault()); // Keep alive in tray

app.on('will-quit', () => {
  stopBackend();
});

app.on('activate', () => {
  mainWindow?.show();
});
