import 'dotenv/config';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { closeDatabase, initDatabase } from './db/database';
import { createClient } from '@supabase/supabase-js';
import type { BackupEndResponse } from './db/SyncManager';
import { SyncManager } from './db/SyncManager';
import {
  create,
  deleteRecord,
  executeSql,
  migrateSchema,
  read,
  tables,
  update,
} from './db/localDB';
import type {
  LocalTables,
  TableName,
  TablesDelete,
  TablesUpdate,
} from '../tables';
import type { ElectronToReactResponse } from '../shared-types';
import { initAllSeedData } from './seed';

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
    iconPath = path.join(process.cwd(), 'electron', 'build', iconName);
  } else {
    iconPath = path.join(process.resourcesPath, 'electron', 'build', iconName);
  }
  return iconPath;
};

const createWindow = () => {
  const iconPath = getIconPath();

  win = new BrowserWindow({
    title: 'Sri Mahaveer Bankers',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      allowRunningInsecureContent: false,
    },
    icon: iconPath,
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    // In production, load the built renderer from app.asar/dist/index.html
    // __dirname points to app.asar/dist-electron/electron when packaged
    const prodIndex = path.join(app.getAppPath(), 'dist', 'index.html');
    void win.loadFile(prodIndex);
  }
  win.maximize();

  win.on('closed', () => {
    win = null;
  });
};

const initSupabase = () => {
  const supabase = createClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_KEY ?? ''
  );
  syncManager = SyncManager.getInstance({
    supabase,
    tables,
    interval: 30 * 60 * 1000, // 30 minutes
    onBackupStart: () => {
      win?.webContents.send('sync-status', { state: 'started' });
    },
    onBackupEnd: (summary: BackupEndResponse) => {
      win?.webContents.send('sync-status', {
        state: 'ended',
        lastSync: Date.now(),
        errors: summary.status ? [] : JSON.stringify(summary.error),
      });
    },
  });

  // await syncManager.start();
};

// Set app name before app is ready (important for macOS)
app.name = 'Sri Mahaveer Bankers';

// Configure remote debugging port for development
app.commandLine.appendSwitch('remote-debugging-port', '7070');
// Allow local file URLs to load other local file resources in production
app.commandLine.appendSwitch('allow-file-access-from-files');

// Initialize database before creating window
void app.whenReady().then(() => {
  // Set dock icon on macOS (use PNG as icns can be problematic)
  if (process.platform === 'darwin' && app.dock) {
    const dockIconPath = path.join(
      process.cwd(),
      'electron',
      'build',
      'logo.png'
    );
    try {
      app.dock.setIcon(dockIconPath);
    } catch (error) {
      console.error('❌ Failed to set dock icon:', error);
    }
  }
  initDatabase();
  migrateSchema();
  createWindow();
  initSupabase();
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
ipcMain.handle(
  'init-seed',
  async (): Promise<ElectronToReactResponse<void>> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Access Database Files', extensions: ['mdb'] }, // 👈 restricts to .mdb only
        ],
      });

      if (!result.canceled) {
        const filePath = result.filePaths[0];
        if (!filePath.endsWith('.mdb')) {
          throw Error('Invalid File');
        }
        initAllSeedData(filePath);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }
);

// Sync
ipcMain.handle('sync-now', async (): Promise<ElectronToReactResponse<void>> => {
  try {
    return { success: true, data: await syncManager?.pushAll() };
  } catch (error: unknown) {
    return {
      success: false,
      error: (error as Error).message,
      stack: error instanceof Error ? error.stack : undefined,
    };
  }
});

ipcMain.handle('is-syncing-now', (): ElectronToReactResponse<boolean> => {
  try {
    return { success: true, data: syncManager?.isRunning ?? false };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
  }
});

ipcMain.handle(
  'initial-pull',
  async (): Promise<ElectronToReactResponse<void | undefined>> => {
    try {
      return { success: true, data: await syncManager?.initialPull() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }
);

ipcMain.handle(
  'db:create',
  <K extends TableName>(
    _event: IpcMainInvokeEvent,
    table: K,
    record: LocalTables<K>
  ): ElectronToReactResponse<null> => {
    try {
      return { success: true, data: create(table, record) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }
);

ipcMain.handle(
  'db:read',
  <K extends TableName>(
    _event: IpcMainInvokeEvent,
    table: K,
    conditions: Partial<LocalTables<K>>,
    fields: keyof LocalTables<K> | '*' = '*',
    isLikeQuery?: boolean
  ): ElectronToReactResponse<LocalTables<K>[] | null> => {
    try {
      return {
        success: true,
        data: read(table, conditions, fields, isLikeQuery),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }
);

ipcMain.handle(
  'db:update',
  <K extends TableName>(
    _event: IpcMainInvokeEvent,
    table: K,
    record: TablesUpdate[K]
  ): ElectronToReactResponse<null> => {
    try {
      const result = update(table, record);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }
);

ipcMain.handle(
  'db:delete',
  <K extends TableName>(
    _event: IpcMainInvokeEvent,
    table: K,
    record: TablesDelete[K]
  ): ElectronToReactResponse<null> => {
    try {
      deleteRecord(table, record);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }
);

ipcMain.handle(
  'db:query',
  (
    _event: IpcMainInvokeEvent,
    query: string,
    params?: unknown[],
    justRun = false
  ): ElectronToReactResponse<unknown> => {
    try {
      return {
        success: true,
        data: executeSql(query, params, justRun as boolean),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }
);
