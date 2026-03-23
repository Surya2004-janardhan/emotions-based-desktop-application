const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  Notification,
  nativeImage,
  shell,
  session,
  dialog,
} = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");

// Allow app-managed support audio playback without requiring explicit user gesture each time.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// Ensure Windows toast notifications support actions by providing an AppUserModelID
try {
  app.setAppUserModelId("com.emotionai.app");
} catch (e) {
  // ignore if not supported
}

// ─── State ────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let pythonProcess = null;
let pythonReady = false;
let pythonReadyCallbacks = [];

// ─── Paths (initialized after app ready) ─────────────────────
let USER_DATA, SETTINGS_FILE, RESULTS_FILE, ANALYSES_DIR;

function mainLog(scope, message, payload) {
  const suffix = payload === undefined ? "" : ` ${JSON.stringify(payload)}`;
  console.log(`${new Date().toISOString()} [${scope}] ${message}${suffix}`);
}

function mainError(scope, message, payload) {
  const suffix = payload === undefined ? "" : ` ${JSON.stringify(payload)}`;
  console.error(`${new Date().toISOString()} [${scope}] ${message}${suffix}`);
}

function initPaths() {
  USER_DATA = app.getPath("userData");
  SETTINGS_FILE = path.join(USER_DATA, "settings.json");
  RESULTS_FILE = path.join(USER_DATA, "results.json");
  ANALYSES_DIR = path.join(USER_DATA, "analyses");
  if (!fs.existsSync(ANALYSES_DIR))
    fs.mkdirSync(ANALYSES_DIR, { recursive: true });
}

// ─── Default Settings ─────────────────────────────────────────
const DEFAULT_SETTINGS = {
  autoMode: false,
  intervalMinutes: 15,
  recordDurationMinutes: 5,
  notifyPermission: "ask", // 'ask' | 'auto'
  musicMappings: {},
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      mainLog("settings", "load ok", { file: SETTINGS_FILE });
      return {
        ...DEFAULT_SETTINGS,
        ...JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")),
      };
    }
  } catch (e) {
    mainError("settings", "load failed", { error: e.message });
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(data) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
    mainLog("settings", "save ok", { file: SETTINGS_FILE });
    return true;
  } catch (e) {
    mainError("settings", "save failed", { error: e.message });
    return false;
  }
}

// ─── Flask Backend (on-demand) ────────────────────────────────
const FLASK_URL = "http://127.0.0.1:5000";
const BACKEND_CWD = path.join(__dirname, "..");
const ROOT_CWD = BACKEND_CWD;

function isBackendListening(port = 5000, host = "127.0.0.1", timeoutMs = 600) {
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
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

function resolvePythonCommand() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;

  const candidates = [
    path.join(ROOT_CWD, ".venv", "Scripts", "python.exe"),
    path.join(ROOT_CWD, "venv", "Scripts", "python.exe"),
    path.join(ROOT_CWD, "myenv", "Scripts", "python.exe"),
    "python",
  ];

  for (const candidate of candidates) {
    if (candidate.includes(path.sep)) {
      if (fs.existsSync(candidate)) return candidate;
    } else {
      return candidate;
    }
  }

  return "python";
}

async function startBackend() {
  if (pythonProcess && !pythonProcess.killed) {
    mainLog("backend", "already running");
    return Promise.resolve();
  }

  if (await isBackendListening()) {
    mainLog("backend", "existing backend detected and reused", {
      host: "127.0.0.1",
      port: 5000,
    });
    pythonReady = true;
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    mainLog("backend", "spawning flask process");
    pythonReady = false;
    pythonReadyCallbacks = [];

    const pythonCmd = resolvePythonCommand();
    mainLog("backend", "python command resolved", { pythonCmd });
    pythonProcess = spawn(pythonCmd, ["app.py"], { cwd: BACKEND_CWD });

    const readyTimer = setTimeout(() => {
      // Assume ready after 8 seconds even if we miss the stdout signal
      if (!pythonReady) {
        pythonReady = true;
        pythonReadyCallbacks.forEach((cb) => cb());
        pythonReadyCallbacks = [];
        mainLog("backend", "flask reported ready via timeout fallback");
        resolve();
      }
    }, 8000);

    pythonProcess.stdout.on("data", (data) => {
      const text = data.toString();
      console.log(`[Flask]: ${text}`);
      if (
        (text.includes("Running on") || text.includes("Serving Flask")) &&
        !pythonReady
      ) {
        clearTimeout(readyTimer);
        pythonReady = true;
        pythonReadyCallbacks.forEach((cb) => cb());
        pythonReadyCallbacks = [];
        mainLog("backend", "flask reported ready via stdout");
        resolve();
      }
    });

    pythonProcess.stderr.on("data", (data) => {
      const text = data.toString();
      console.error(`[Flask Error]: ${text}`);
      if (
        text.includes("Address already in use") ||
        text.includes("Port 5000 is in use")
      ) {
        mainLog("backend", "port already in use, reusing existing backend");
        clearTimeout(readyTimer);
        pythonReady = true;
        pythonReadyCallbacks.forEach((cb) => cb());
        pythonReadyCallbacks = [];
        resolve();
        if (pythonProcess && !pythonProcess.killed) {
          pythonProcess.kill("SIGTERM");
        }
        return;
      }
      if (text.includes("ModuleNotFoundError: No module named 'flask'")) {
        mainError("backend", "flask dependency missing");
      }
      // Flask dev server prints its "Running on" to stderr
      if (
        (text.includes("Running on") || text.includes("Serving Flask")) &&
        !pythonReady
      ) {
        clearTimeout(readyTimer);
        pythonReady = true;
        pythonReadyCallbacks.forEach((cb) => cb());
        pythonReadyCallbacks = [];
        mainLog("backend", "flask reported ready via stderr");
        resolve();
      }
    });

    pythonProcess.on("exit", (code) => {
      mainLog("backend", "process exited", { code });
      pythonProcess = null;
      pythonReady = false;
    });

    pythonProcess.on("error", (err) => {
      mainError("backend", "failed to start", { error: err.message });
      reject(err);
    });
  });
}

function stopBackend() {
  if (pythonProcess && !pythonProcess.killed) {
    mainLog("backend", "stopping flask");
    pythonProcess.kill("SIGTERM");
    pythonProcess = null;
    pythonReady = false;
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────
function setupIPC() {
  ipcMain.on("renderer-log", (_event, entry) => {
    const suffix =
      entry?.payload === undefined ? "" : ` ${JSON.stringify(entry.payload)}`;
    const line = `${entry?.ts || new Date().toISOString()} [renderer:${entry?.scope || "unknown"}] ${entry?.message || ""}${suffix}`;
    if (entry?.level === "error") console.error(line);
    else if (entry?.level === "warn") console.warn(line);
    else console.log(line);
  });

  // Settings persistence
  ipcMain.handle("load-settings", () => loadSettings());

  ipcMain.handle("save-settings", (_e, data) => {
    const ok = saveSettings(data);
    return { ok };
  });

  ipcMain.handle("pick-music-file", async () => {
    const response = await dialog.showOpenDialog(mainWindow, {
      title: "Choose support audio",
      properties: ["openFile"],
      filters: [
        {
          name: "Audio",
          extensions: ["mp3", "wav", "m4a", "aac", "ogg", "flac"],
        },
      ],
    });

    if (response.canceled || !response.filePaths?.length) {
      mainLog("settings", "music picker cancelled");
      return { canceled: true };
    }

    const filePath = response.filePaths[0];
    mainLog("settings", "music file selected", { filePath });
    return {
      canceled: false,
      filePath,
      fileName: path.basename(filePath),
    };
  });

  // History (results log)
  ipcMain.handle("load-results", () => {
    try {
      if (fs.existsSync(RESULTS_FILE)) {
        mainLog("results", "load ok", { file: RESULTS_FILE });
        return JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"));
      }
    } catch (e) {
      mainError("results", "load failed", { error: e.message });
    }
    return [];
  });

  ipcMain.handle("save-result", (_e, result) => {
    try {
      let arr = [];
      if (fs.existsSync(RESULTS_FILE))
        arr = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"));
      arr.unshift({ ...result, timestamp: new Date().toISOString() });
      // Keep max 500 entries
      if (arr.length > 500) arr = arr.slice(0, 500);
      fs.writeFileSync(RESULTS_FILE, JSON.stringify(arr, null, 2), "utf-8");
      mainLog("results", "save ok", {
        file: RESULTS_FILE,
        emotion: result?.fused_emotion,
      });
      return { ok: true };
    } catch (e) {
      mainError("results", "save failed", { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  // Per-day cached LLM analyses
  ipcMain.handle("load-analysis", (_e, dateKey) => {
    const file = path.join(ANALYSES_DIR, `${dateKey}.json`);
    try {
      if (fs.existsSync(file)) {
        mainLog("analysis", "load cached analysis ok", { file });
        return JSON.parse(fs.readFileSync(file, "utf-8"));
      }
    } catch (e) {
      mainError("analysis", "load cached analysis failed", {
        error: e.message,
        file,
      });
    }
    return null;
  });

  ipcMain.handle("save-analysis", (_e, dateKey, data) => {
    const file = path.join(ANALYSES_DIR, `${dateKey}.json`);
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
      mainLog("analysis", "save cached analysis ok", { file });
      return { ok: true };
    } catch (e) {
      mainError("analysis", "save cached analysis failed", {
        error: e.message,
        file,
      });
      return { ok: false };
    }
  });

  // On-demand backend control
  ipcMain.handle("start-backend", async () => {
    try {
      await startBackend();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("stop-backend", () => {
    stopBackend();
    return { ok: true };
  });

  ipcMain.handle("backend-status", async () => {
    const running =
      (!!pythonProcess && pythonReady) || (await isBackendListening());
    mainLog("backend", "status requested", { running });
    return { running };
  });

  // Native OS Notification
  ipcMain.handle("notify-shift", (_e, payload) => {
    const { emotion, autoPlay, musicPath, meme } = payload || {};
    mainLog("notify", "notify-shift received", {
      emotion,
      autoPlay,
      musicPath,
    });
    const supported = Notification.isSupported();
    mainLog("notify", "notification capability checked", { supported });
    if (!supported) return { ok: false, error: "Notification not supported" };

    // Emoji map for titles
    const EMOJI_MAP = {
      happy: "😊",
      neutral: "😐",
      sad: "😔",
      angry: "😡",
      fearful: "😨",
      disgust: "🤢",
    };
    const emoji = EMOJI_MAP[emotion] || "🎭";

    const options = {
      title: `${emoji} EmotionAI - Emotional Shift`,
      silent: false,
      urgency: "normal",
    };
    options.body = autoPlay
      ? `Detected shift to ${emotion}. Playing your mapped playlist now.`
      : `Detected shift to ${emotion}. Click Play to hear a supportive track, or No to dismiss.`;

    // If caller attached a meme and requested a meme-only notification, render that distinctly
    if (meme && payload && payload.memeOnly) {
      try {
        const m = meme;
        options.title = `${emoji} Meme Break`;
        options.body = `${m.caption || ""}\n\n${m.reason || ""}`.trim();
        if (m.imagePath && fs.existsSync(m.imagePath)) {
          try {
            options.icon = nativeImage.createFromPath(m.imagePath);
          } catch (e) {
            mainError("notify", "failed to load meme image", {
              error: e.message,
              path: m.imagePath,
            });
          }
        }
      } catch (e) {
        // ignore malformed meme
      }
    }

    // When autoPlay is disabled (ask mode), include action buttons for user choice
    if (!autoPlay) {
      options.actions = [
        { type: "button", text: "Play" },
        { type: "button", text: "No" },
      ];
      // Some platforms support a different close button text
      options.closeButtonText = "Dismiss";
    }

    const notif = new Notification(options);

    notif.on("click", () => {
      mainLog("notify", "notification clicked", { emotion, musicPath });
      if (musicPath) {
        shell.openPath(musicPath);
      }
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    // Handle action button clicks (index 0 => Play, index 1 => No)
    notif.on("action", (_event, index) => {
      mainLog("notify", "notification action", { emotion, index, musicPath });
      if (!mainWindow) return;
      if (index === 0) {
        // User chose Play — instruct renderer to play the mapped music
        mainWindow.webContents.send("notification-action", {
          action: "play",
          emotion,
          musicPath,
        });
      } else {
        // User chose No — inform renderer (no-op by default)
        mainWindow.webContents.send("notification-action", {
          action: "skip",
          emotion,
        });
      }
    });

    notif.show();
    mainLog("notify", "notification shown", { emotion });

    return { ok: true };
  });

  // Show/hide window
  ipcMain.handle("show-window", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function setupMediaPermissions() {
  const ses = session.defaultSession;
  if (!ses) return;

  ses.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin) => {
      if (permission !== "media") return true;
      return (
        requestingOrigin.startsWith("http://127.0.0.1:5173") ||
        requestingOrigin.startsWith("file://")
      );
    },
  );

  ses.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      if (permission === "media") {
        const allowedOrigin =
          details.requestingUrl.startsWith("http://127.0.0.1:5173") ||
          details.requestingUrl.startsWith("file://");
        callback(allowedOrigin);
        return;
      }
      callback(true);
    },
  );
}

// ─── Create Window ────────────────────────────────────────────
function createWindow() {
  mainLog("window", "creating main window");
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: true, // Show immediately; tray-only means minimize-to-tray on CLOSE, not hide on open
    frame: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
    autoHideMenuBar: true,
  });

  const indexPath = path.join(__dirname, "dist", "index.html");
  const devUrl = "http://127.0.0.1:5173";

  if (!app.isPackaged) {
    mainWindow
      .loadURL(devUrl)
      .then(() => {
        mainLog("window", "loaded dev server", { devUrl });
      })
      .catch((e) => {
        mainError(
          "window",
          "dev server unavailable, falling back to dist build",
          { error: e.message },
        );
        if (fs.existsSync(indexPath)) {
          mainWindow.loadFile(indexPath).catch((err) =>
            mainError("window", "dist fallback failed", {
              error: err.message,
            }),
          );
        }
      });
  } else if (fs.existsSync(indexPath)) {
    mainWindow
      .loadFile(indexPath)
      .catch((e) =>
        mainError("window", "load file failed", { error: e.message }),
      );
  } else {
    mainError("window", "packaged app missing dist/index.html");
  }

  // Minimize to tray instead of closing
  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  mainWindow.on("ready-to-show", () => {
    // Only show if user explicitly launches (not autostart)
    // Tray click will show the window
  });
}

// ─── System Tray ─────────────────────────────────────────────
function createTray() {
  mainLog("tray", "creating tray");
  let iconPath = path.join(__dirname, "public", "icon.jpg");
  if (!fs.existsSync(iconPath))
    iconPath = path.join(__dirname, "dist", "icon.jpg");

  const trayIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(trayIcon);

  const buildMenu = () =>
    Menu.buildFromTemplate([
      {
        label: "Open EmotionAI",
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          app.isQuiting = true;
          app.quit();
        },
      },
    ]);

  tray.setToolTip("EmotionAI - Background Monitor");
  tray.setContextMenu(buildMenu());

  tray.on("click", () => {
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
  const APP_ID = "EmotionAI";
  try {
    app.setAppUserModelId(APP_ID);
  } catch (e) {
    /* ignore */
  }

  initPaths(); // Must be first; sets up file paths

  setupMediaPermissions();
  setupIPC();
  createWindow();
  createTray();

  // Pre-warm backend in the background
  startBackend().catch((e) =>
    console.error("[App] Backend pre-warm failed:", e),
  );

  // Ensure a Start Menu shortcut exists on Windows so toasts show as app toasts
  if (process.platform === "win32") {
    try {
      const shortcutPath = path.join(
        app.getPath("startMenu"),
        "Programs",
        "EmotionAI.lnk",
      );
      if (!fs.existsSync(shortcutPath)) {
        const options = {
          target: process.execPath,
          args: "",
          description: "EmotionAI",
          appUserModelId: APP_ID,
        };
        // create shortcut; writeShortcutLink returns boolean
        try {
          shell.writeShortcutLink(shortcutPath, "create", options);
          mainLog("notify", "startmenu shortcut created", { shortcutPath });
        } catch (err) {
          mainError("notify", "failed to create shortcut", {
            error: err.message,
          });
        }
      }
    } catch (err) {
      mainError("notify", "ensure shortcut failed", { error: err.message });
    }
  }
});

app.on("window-all-closed", (e) => e.preventDefault()); // Keep alive in tray

app.on("will-quit", () => {
  stopBackend();
});

app.on("activate", () => {
  mainWindow?.show();
});
