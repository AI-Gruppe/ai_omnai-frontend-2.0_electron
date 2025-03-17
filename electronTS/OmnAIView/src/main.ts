import { app, BrowserWindow, ipcMain } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs-extra";
import { createWindow } from "./renderer";

// Check if app was started with squirell for install process
if (require("electron-squirrel-startup")) app.quit();

let backendProcess: ChildProcess | null = null; 

function getBackendPath(): string{
  const exePath : string = app.isPackaged
  ? path.join(process.resourcesPath, "MiniOmni.exe") // production 
  : path.join(__dirname, "..", "res", "omnai", "MiniOmni.exe"); // development

  return exePath; 
}

function startBackend(): void {
  const exePath : string = getBackendPath(); 

  if(fs.existsSync(exePath)){
    backendProcess = spawn(exePath, ["-w"]);}
}

function stopBackend(): void {
  if (backendProcess) {
    backendProcess.kill();
    console.log("Backend process stopped.");
  }
}

// IPC Handler for backend
ipcMain.handle("start-backend", async () => {
  startBackend();
  return "Backend started.";
});

ipcMain.handle("run-omnai-command", (event, commandArgs: string[]) => {
  const exePath: string = getBackendPath(); 

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
