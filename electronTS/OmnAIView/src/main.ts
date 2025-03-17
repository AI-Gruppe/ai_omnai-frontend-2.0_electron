import { app, BrowserWindow, ipcMain } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs-extra";

// Check if app was started with squirell for install process
if (require("electron-squirrel-startup")) app.quit();

let backendProcess: ChildProcess | null = null; 

function startBackend(): void {
  const exePath= app.isPackaged
  ? path.join(process.resourcesPath, "MiniOmni.exe")
  : path.join(__dirname, "res", "omnai", "MiniOmni.exe");

  if(fs.existsSync(exePath)){
    backendProcess = spawn(exePath, ["-w"]);}
}

function stopBackend(): void {
  if (backendProcess) {
    backendProcess.kill();
    console.log("Backend process stopped.");
  }
}

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

// IPC Handler for backend
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

// start app
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// close app 
app.on("window-all-closed", () => {
  stopBackend();

  if (process.platform !== "darwin") {
    app.quit();
  }
});
