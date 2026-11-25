// XI: Forever Offline for Windows and Linux: a window around the live web app (https://xiforever.com/app/), so it is
// always the newest version without updating this program. Links to other sites open in your normal browser.
// Offline: a small page that tries again. XIFO_APP_URL=... points it somewhere else (for testing).
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const APP_URL = process.env.XIFO_APP_URL || 'https://xiforever.com/app/';
const ORIGIN = new URL(APP_URL).origin;

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
function create() {
  win = new BrowserWindow({
    width: 480, height: 920, minWidth: 380, minHeight: 600,
    title: 'XI: Forever Offline', backgroundColor: '#0A1030', icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:')) return;
    if (!url.startsWith(ORIGIN)) { e.preventDefault(); shell.openExternal(url); }
  });
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMain) => {
    if (isMain && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'), { query: { u: APP_URL } });
  });
  win.loadURL(APP_URL);
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
