import { app, BrowserWindow, ipcMain } from "electron";
import { createWindow } from "./renderer";
import { startBackend, stopBackend } from "./backend";

// Check if app was started with squirell for install process
if (require("electron-squirrel-startup")) app.quit();

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
