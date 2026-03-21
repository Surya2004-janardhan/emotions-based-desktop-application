const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

// Linux machines without proper VAAPI support can spam GPU init errors.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-features', 'VaapiVideoDecoder,VaapiVideoEncoder,VideoCaptureUseGpuMemoryBuffer');
}
// Allow app-managed support audio playback without requiring explicit user gesture each time.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

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
const ROOT_CWD = BACKEND_CWD;

function isBackendListening(port = 5000, host = '127.0.0.1', timeoutMs = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

function resolvePythonCommand() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;

  if (process.platform === 'win32') {
    return 'python';
  }

  const candidates = [
    path.join(ROOT_CWD, 'linuxvnev', 'bin', 'python'),
    path.join(ROOT_CWD, 'linuxvenv', 'bin', 'python'),
    path.join(ROOT_CWD, 'linuxvnven', 'bin', 'python'),
    path.join(ROOT_CWD, '.venv', 'bin', 'python'),
    path.join(ROOT_CWD, 'myenv', 'bin', 'python'),
    path.join(ROOT_CWD, 'venv', 'bin', 'python'),
    'python3',
    'python',
  ];

  for (const candidate of candidates) {
    if (candidate.includes(path.sep)) {
      if (fs.existsSync(candidate)) return candidate;
    } else {
      return candidate;
    }
  }

  return 'python3';
}

async function startBackend() {
  if (pythonProcess && !pythonProcess.killed) {
    console.log('[Backend] Already running');
    return Promise.resolve();
  }

  if (await isBackendListening()) {
    console.log('[Backend] Existing backend detected on 127.0.0.1:5000. Reusing it.');
    pythonReady = true;
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    console.log('[Backend] Spawning Flask...');
    pythonReady = false;
    pythonReadyCallbacks = [];

    const pythonCmd = resolvePythonCommand();
    console.log(`[Backend] Python command: ${pythonCmd}`);
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
      if (text.includes('Address already in use') || text.includes('Port 5000 is in use')) {
        console.log('[Backend] Port 5000 already in use. Reusing existing backend instance.');
        clearTimeout(readyTimer);
        pythonReady = true;
        pythonReadyCallbacks.forEach(cb => cb());
        pythonReadyCallbacks = [];
        resolve();
        if (pythonProcess && !pythonProcess.killed) {
          pythonProcess.kill('SIGTERM');
        }
        return;
      }
      if (text.includes("ModuleNotFoundError: No module named 'flask'")) {
        console.error('[Backend] Flask dependency missing. Run backend setup and install requirements in your Python environment.');
      }
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

  ipcMain.handle('backend-status', async () => {
    const running = (!!pythonProcess && pythonReady) || (await isBackendListening());
    return { running };
  });

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
  const devUrl = 'http://127.0.0.1:5173';

  // In local development (not packaged), always prefer Vite dev server so UI changes reflect immediately.
  if (!app.isPackaged) {
    mainWindow.loadURL(devUrl).then(() => {
      console.log(`[Window] Loaded dev server: ${devUrl}`);
    }).catch((e) => {
      console.error('[Window] Dev server unavailable, falling back to dist build:', e.message);
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath).catch(err => console.error('[Window] Dist fallback failed:', err));
      }
    });
  } else if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath).catch(e => console.error('[Window]', e));
  } else {
    console.error('[Window] Packaged app missing dist/index.html');
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

function setupMediaPermissions() {
  const ses = session.defaultSession;
  if (!ses) return;

  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    if (permission !== 'media') return true;
    return requestingOrigin.startsWith('http://127.0.0.1:5173') || requestingOrigin.startsWith('file://');
  });

  ses.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (permission === 'media') {
      const allowedOrigin = details.requestingUrl.startsWith('http://127.0.0.1:5173') || details.requestingUrl.startsWith('file://');
      callback(allowedOrigin);
      return;
    }
    callback(true);
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

  setupMediaPermissions();
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
