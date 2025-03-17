import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs-extra";

let backendProcess: ChildProcess | null = null; 

export function getBackendPath(): string{
  const exePath : string = app.isPackaged
  ? path.join(process.resourcesPath, "MiniOmni.exe") // production 
  : path.join(__dirname, "..", "res", "omnai", "MiniOmni.exe"); // development

  return exePath; 
}

export function startBackend(): void {
  const exePath : string = getBackendPath(); 

  if(fs.existsSync(exePath)){
    backendProcess = spawn(exePath, ["-w"]);}
}

export function stopBackend(): void {
  if (backendProcess) {
    backendProcess.kill();
    console.log("Backend process stopped.");
  }
}