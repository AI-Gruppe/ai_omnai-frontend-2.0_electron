import { app, BrowserWindow, ipcMain } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs-extra";

// Prüfe, ob die App über Squirrel Startup gestartet wurde (Windows-Installer-Handling)
if (require("electron-squirrel-startup")) app.quit();

let backendProcess: ChildProcess | null = null; 

// Backend starten
function startBackend(): void {
  const exePath= app.isPackaged
  ? path.join(process.resourcesPath, "MiniOmni.exe")
  : path.join(__dirname, "res", "omnai", "MiniOmni.exe");

  if(fs.existsSync(exePath)){
    backendProcess = spawn(exePath, ["-w"]);}
}

// Backend stoppen
function stopBackend(): void {
  if (backendProcess) {
    backendProcess.kill();
    console.log("Backend process stopped.");
  }
}

// Electron-Hauptfenster erstellen
function createWindow(): void {
  const mainWindow: BrowserWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, "res", "Icon.ico"),
  });

  const indexPath: string = path.join(__dirname, "..", "res", "angular", "browser", "index.html");
  mainWindow.loadFile(indexPath).catch(err => console.error("Fehler beim Laden der HTML-Datei:", err));
}

// IPC-Handler für das Backend
ipcMain.handle("start-backend", async () => {
  startBackend();
  return "Backend started.";
});

ipcMain.handle("run-omnai-command", (event, commandArgs: string[]) => {
  const exePath: string = app.isPackaged
  ? path.join(process.resourcesPath, "MiniOmni.exe")
  : path.join(__dirname, "res", "omnai", "MiniOmni.exe");

  const omniProcess: ChildProcess = spawn(exePath, commandArgs);

  omniProcess.stdout?.on("data", (data: Buffer) => {
    event.sender.send("omnai-output", data.toString());
  });

  omniProcess.stderr?.on("data", (data: Buffer) => {
    event.sender.send("omnai-error", data.toString());
  });

  omniProcess.on("close", (code: number) => {
    event.sender.send("omnai-closed", `Process exited with code ${code}`);
  });
});

startBackend();

// Electron-App initialisieren
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// App beenden, wenn alle Fenster geschlossen wurden
app.on("window-all-closed", () => {
  stopBackend();

  if (process.platform !== "darwin") {
    app.quit();
  }
});
