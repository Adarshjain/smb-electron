import 'dotenv/config';
import {app, BrowserWindow, ipcMain} from 'electron';
import path from 'path';
import {closeDatabase, initDatabase,} from './db/database';
import {createClient} from '@supabase/supabase-js';
import type {BackupEndResponse} from "./db/SyncManager";
import {SyncManager} from "./db/SyncManager";
import {create, deleteRecord, executeSql, migrateSchema, read, tables, update} from "./db/localDB";
import type {LocalTables, TableName, Tables} from "../tables";
import type {ElectronToReactResponse} from "../shared-types";
import {initAreas} from "./seed";

type IpcMainInvokeEvent = Electron.IpcMainInvokeEvent;

let win: BrowserWindow | null = null;
let syncManager: SyncManager | null;

export type { ElectronToReactResponse };

const getIconPath = () => {
    // For BrowserWindow, always use PNG as it's most compatible
    // .icns and .ico are for app packaging only
    const iconName = 'logo.png';
    
    // In development, icons are in electron/build
    // In production, they'll be in the resources folder
    let iconPath;
    if (process.env.VITE_DEV_SERVER_URL) {
        // Development mode - use project root path
        iconPath = path.join(process.cwd(), 'electron', 'build', iconName);
    } else {
        // Production mode - use app path
        iconPath = path.join(process.resourcesPath, 'electron', 'build', iconName);
    }
    return iconPath;
};

const createWindow = () => {
    const iconPath = getIconPath();
    
    win = new BrowserWindow({
        title: 'Sri Mahaveer Bankers',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: iconPath,
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

const initSupabase = async () => {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_KEY!
    );
    syncManager = SyncManager.getInstance({
        supabase,
        tables,
        interval: 30 * 60 * 1000, // 30 minutes
        onBackupStart: () => {
            win?.webContents.send('sync-status', {state: 'started'});
        },
        onBackupEnd: (summary: BackupEndResponse) => {
            win?.webContents.send('sync-status', {
                state: 'ended',
                lastSync: Date.now(),
                errors: summary.status ? [] : JSON.stringify(summary.error)
            });
        }
    });

    await syncManager.start();
}

// Set app name before app is ready (important for macOS)
app.name = 'Sri Mahaveer Bankers';

// Initialize database before creating window
app.whenReady().then(async () => {
    // Set dock icon on macOS (use PNG as icns can be problematic)
    if (process.platform === 'darwin' && app.dock) {
        const dockIconPath = path.join(process.cwd(), 'electron', 'build', 'logo.png');
        try {
            app.dock.setIcon(dockIconPath);
        } catch (error) {
            console.error('❌ Failed to set dock icon:', error);
        }
    }
    initDatabase();
    await migrateSchema();
    createWindow();
    await initSupabase();
});


app.on('window-all-closed', () => {
    closeDatabase();
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    closeDatabase();
});


// IPC Handlers

// Testing
ipcMain.handle('init-seed', async (): Promise<ElectronToReactResponse<void>> => {
    try {
        initAreas();
        return {success: true};
    } catch (error) {
        return {success: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined};
    }
});


// Sync
ipcMain.handle('sync-now', async (): Promise<ElectronToReactResponse<void>> => {
    try {
        return {success: true, data: await syncManager?.pushAll()};
    } catch (error) {
        return {success: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined};
    }
});

ipcMain.handle('is-syncing-now', async (): Promise<ElectronToReactResponse<boolean | undefined>> => {
    try {
        return {success: true, data: syncManager?.isRunning};
    } catch (error) {
        return {success: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined};
    }
});

ipcMain.handle('initial-pull', async (): Promise<ElectronToReactResponse<void | undefined>> => {
    try {
        return {success: true, data: await syncManager?.initialPull()};
    } catch (error) {
        return {success: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined};
    }
});

ipcMain.handle('db:create', async <K extends TableName>(
    _event: IpcMainInvokeEvent,
    table: K,
    record: Tables[K]['Row']
): Promise<ElectronToReactResponse<null>> => {
    try {
        return {success: true, data: create(table, record)};
    } catch (error) {
        return {success: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined};
    }
});

ipcMain.handle('db:read', async <K extends TableName>(
    _event: IpcMainInvokeEvent,
    table: K,
    conditions: Partial<LocalTables<K>>,
    fields: keyof LocalTables<K> | '*' = '*'
): Promise<ElectronToReactResponse<LocalTables<K>[] | null>> => {
    try {
        return {success: true, data: read(table, conditions, fields)};
    } catch (error) {
        return {success: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined};
    }
});

ipcMain.handle('db:update', async <K extends TableName>(
    _event: IpcMainInvokeEvent,
    table: K,
    record: Tables[K]['Update']
): Promise<ElectronToReactResponse<null>> => {
    try {
        const result = update(table, record);
        return {success: true, data: result};
    } catch (error) {
        return {success: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined};
    }
});

ipcMain.handle('db:delete', async <K extends TableName>(
    _event: IpcMainInvokeEvent,
    table: K,
    record: Tables[K]['Delete']
): Promise<ElectronToReactResponse<null>> => {
    try {
        deleteRecord(table, record);
        return {success: true};
    } catch (error) {
        return {success: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined};
    }
});

ipcMain.handle('db:query', async (
    _event: IpcMainInvokeEvent,
    query: string,
    params?: unknown[]
): Promise<ElectronToReactResponse<unknown | null>> => {
    try {
        return {success: true, data: executeSql(query, params)};
    } catch (error) {
        return {success: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined};
    }
});
