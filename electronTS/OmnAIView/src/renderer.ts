import { BrowserWindow} from "electron";
import * as path from "path";

export function createWindow(): void {
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