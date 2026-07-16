/**
 * MarioG - Electron Main Process
 * Launches the game in a native desktop window.
 * 
 * VBUILD(TM) - Built by VBUILD Lanka
 */
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 850,
    minHeight: 550,
    title: 'MarioG - Super Platformer',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Remove the default menu bar for a cleaner game experience
  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
