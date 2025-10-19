import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let win: BrowserWindow | null = null;

const createWindow = () => {
    win = new BrowserWindow({
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // Maximize window to use full available space
    win.maximize();

    if (process.env.VITE_DEV_SERVER_URL) {
        // Dev mode: load Vite server
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        // Production mode: load built React files
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    win.on('closed', () => {
        win = null;
    });
};

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('ping', () => 'pong');
