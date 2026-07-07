const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("node:path");
const net = require("node:net");
const fs = require("node:fs");
const { spawn } = require("node:child_process");

let mainWindow = null;
let serverProcess = null;
let serverPort = 0;

function appRoot() {
  return path.resolve(__dirname, "..");
}

function resolveFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 8787;
      server.close(() => resolve(port));
    });
  });
}

function canUsePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

function portFromUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return Number(url.port || (url.protocol === "https:" ? 443 : 80));
  } catch {
    return 0;
  }
}

async function existingNexaServer(port) {
  try {
    const response = await fetch(`http://localhost:${port}/api/system`, { signal: AbortSignal.timeout(1200) });
    return response.ok;
  } catch {
    return false;
  }
}

async function desktopReadyNexaServer(port) {
  try {
    const response = await fetch(`http://localhost:${port}/api/auth/providers`, {
      signal: AbortSignal.timeout(1200),
      headers: { "cache-control": "no-cache" }
    });
    if (!response.ok) return false;
    const payload = await response.json();
    const google = Array.isArray(payload.providers)
      ? payload.providers.find((provider) => provider.id === "google")
      : null;
    return Boolean(google?.desktop && google?.desktopStartUrl);
  } catch {
    return false;
  }
}

async function resolveDesktopPort(preferredPort) {
  const port = Number(preferredPort || 8787);
  if (Number.isInteger(port) && port > 0 && await canUsePort(port)) return port;
  return await resolveFreePort();
}

async function waitForServer(port, timeoutMs = 45000) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/system`);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 450));
  }
  throw new Error(`Server did not start: ${lastError}`);
}

function bundledEnginesDir(root) {
  const packagedEngines = path.join(process.resourcesPath || root, "engines");
  if (app.isPackaged && fs.existsSync(packagedEngines)) return packagedEngines;
  return path.join(root, "engines");
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    const quote = value[0];
    if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
      if (quote === "\"") {
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, "\"")
          .replace(/\\\\/g, "\\");
      }
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    env[key] = value;
  }
  return env;
}

function loadDesktopEnv(root) {
  const userData = app.getPath("userData");
  const exeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(root, ".env"),
    path.join(root, "Nexa.env"),
    path.join(root, "Nexa.env.txt"),
    path.join(userData, ".env"),
    path.join(userData, "Nexa.env"),
    path.join(userData, "Nexa.env.txt"),
    path.join(exeDir, ".env"),
    path.join(exeDir, "Nexa.env"),
    path.join(exeDir, "Nexa.env.txt")
  ];
  return candidates.reduce((merged, filePath) => ({ ...merged, ...readEnvFile(filePath) }), {});
}

function resolveAppIcon() {
  const root = appRoot();
  const candidates = [
    path.join(root, "build", "icon.ico"),
    path.join(root, "build", "icon.png")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
}

async function startLocalServer() {
  if (serverProcess) return serverPort;

  const root = appRoot();
  const dataDir = path.join(app.getPath("userData"), "data");
  const workspaceRoot = path.join(app.getPath("documents"), "Nexa Workspace");
  const enginesDir = bundledEnginesDir(root);
  const envFromFiles = loadDesktopEnv(root);
  const baseEnv = { ...envFromFiles, ...process.env };

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const preferredPort =
    baseEnv.NEXA_DESKTOP_PORT ||
    portFromUrl(baseEnv.GOOGLE_REDIRECT_URI) ||
    portFromUrl(baseEnv.APP_PUBLIC_URL) ||
    baseEnv.PORT ||
    8787;
  const numericPreferredPort = Number(preferredPort);
  if (Number.isInteger(numericPreferredPort) && numericPreferredPort > 0 && !(await canUsePort(numericPreferredPort))) {
    if (await desktopReadyNexaServer(numericPreferredPort)) {
      serverPort = numericPreferredPort;
      return serverPort;
    }
    if (await existingNexaServer(numericPreferredPort)) {
      throw new Error(
        `Port ${numericPreferredPort} is already used by an older Nexa server. ` +
        "Quit all old Nexa windows or stop the old node server, then start Nexa again."
      );
    }
    throw new Error(
      `Port ${numericPreferredPort} is already used by another app. ` +
      "Google login needs this local callback port, so close that app and start Nexa again."
    );
  }

  serverPort = await resolveDesktopPort(preferredPort);
  const serverEntry = path.join(root, "server.mjs");
  const publicUrl = `http://localhost:${serverPort}`;
  const childEnv = {
    ...baseEnv,
    ELECTRON_RUN_AS_NODE: "1",
    NEXA_DESKTOP: "1",
    PORT: String(serverPort),
    HOST: "127.0.0.1",
    APP_PUBLIC_URL: publicUrl,
    GOOGLE_REDIRECT_URI: baseEnv.GOOGLE_REDIRECT_URI || `${publicUrl}/api/auth/google/callback`,
    DATA_DIR: dataDir,
    WORKSPACE_ROOT: workspaceRoot,
    VIDEO_PROVIDER: baseEnv.VIDEO_PROVIDER || "free",
    ENGINES_DIR: baseEnv.ENGINES_DIR || enginesDir,
    COMFYUI_DIR: baseEnv.COMFYUI_DIR || path.join(enginesDir, "ComfyUI"),
    COMFYUI_AUTO_START: baseEnv.COMFYUI_AUTO_START || "true"
  };

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: root,
    env: childEnv,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  serverProcess.stdout.on("data", (chunk) => {
    console.log(`[agent-server] ${chunk.toString().trim()}`);
  });
  serverProcess.stderr.on("data", (chunk) => {
    console.error(`[agent-server] ${chunk.toString().trim()}`);
  });
  serverProcess.on("exit", (code) => {
    console.log(`[agent-server] exited with code ${code}`);
    serverProcess = null;
  });

  await waitForServer(serverPort);
  return serverPort;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#0d0e12",
    title: "Nexa",
    icon: resolveAppIcon(),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://localhost:${serverPort}`) || url.startsWith(`http://127.0.0.1:${serverPort}`)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(`http://localhost:${serverPort}`) || url.startsWith(`http://127.0.0.1:${serverPort}`)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  await mainWindow.loadURL(`http://localhost:${serverPort}`);
}

app.whenReady().then(async () => {
  try {
    await startLocalServer();
    await createWindow();
  } catch (error) {
    dialog.showErrorBox("Nexa failed to start", error.stack || error.message);
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
