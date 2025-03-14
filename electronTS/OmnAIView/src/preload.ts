// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

interface OmnAIAPI {
    sendCommand: (commandArgs: string[]) => Promise<void>;
    startBackend: () => Promise<void>;
    onOutput: (callback: (data: string) => void) => void;
    onError: (callback: (error: string) => void) => void;
    onClosed: (callback: (message: string) => void) => void;
  }
  
  // Sicheren Zugriff auf APIs gewähren
  const omnaiAPI: OmnAIAPI = {
    // Sendet Befehle an den Backend-Prozess
    sendCommand: (commandArgs: string[]) => ipcRenderer.invoke("run-omnai-command", commandArgs),
  
    // Startet den Backend-Prozess
    startBackend: () => ipcRenderer.invoke("start-backend"),
  
    // Empfangt Backend-Output
    onOutput: (callback: (data: string) => void) => {
      ipcRenderer.on("omnai-output", (_event: IpcRendererEvent, data: string) => callback(data));
    },
  
    // Empfangt Backend-Fehler
    onError: (callback: (error: string) => void) => {
      ipcRenderer.on("omnai-error", (_event: IpcRendererEvent, error: string) => callback(error));
    },
  
    // Empfangt Nachricht, wenn der Backend-Prozess beendet wurde
    onClosed: (callback: (message: string) => void) => {
      ipcRenderer.on("omnai-closed", (_event: IpcRendererEvent, message: string) => callback(message));
    },
  };
  
  // Die API sicher verfügbar machen
  contextBridge.exposeInMainWorld("omnai", omnaiAPI);