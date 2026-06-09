const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
let serverProcess;

const isDev = process.env.NODE_ENV === "development";
const PORT = process.env.PORT || 3000;

function startServer() {
  if (isDev) return;
  const serverPath = path.join(process.resourcesPath, "server", "node-build.mjs");
  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
    },
    stdio: "pipe",
  });
  serverProcess.stdout?.on("data", (d) => console.log("[server]", d.toString()));
  serverProcess.stderr?.on("data", (d) => console.error("[server]", d.toString()));
}

async function waitForServer(url, retries = 20, delay = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      const http = require("http");
      await new Promise((resolve, reject) => {
        http.get(url, resolve).on("error", reject);
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    title: "ListStock",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
    icon: path.join(__dirname, "..", "public", "icon.png"),
    backgroundColor: "#ffffff",
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Открывать внешние ссылки в браузере
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const appUrl = isDev
    ? `http://localhost:${PORT}`
    : `http://localhost:${PORT}`;

  mainWindow.loadURL(appUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  startServer();

  if (!isDev) {
    const ok = await waitForServer(`http://localhost:${PORT}/health`);
    if (!ok) {
      console.error("Сервер не запустился за отведённое время");
    }
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  serverProcess?.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  serverProcess?.kill();
});
