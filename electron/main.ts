import dotenv from 'dotenv';
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
import * as Sentry from '@sentry/electron/main';
import fs from 'fs';

// Load environment variables from the correct location
const loadEnvFile = () => {
  let envPath: string;

  if (process.env.VITE_DEV_SERVER_URL) {
    // Development mode: .env is in the project root
    envPath = path.join(process.cwd(), '.env');
  } else {
    // Production mode: .env is in resources folder
    envPath = path.join(process.resourcesPath, '.env');
  }

  // Check if .env file exists before loading
  if (fs.existsSync(envPath)) {
    console.log(`✅ Loading .env from: ${envPath}`);
    dotenv.config({ path: envPath });
    console.log('✅ Environment variables loaded successfully');
  } else {
    console.warn(`⚠️ .env file not found at: ${envPath}`);
  }
};

// Load environment variables immediately
loadEnvFile();

// Initialize Sentry for the main process
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment:
      process.env.SENTRY_ENVIRONMENT ??
      (process.env.VITE_DEV_SERVER_URL ? 'development' : 'production'),

    // Performance Monitoring
    tracesSampleRate: 1,

    // Additional configuration
    beforeSend(event, hint) {
      // Log errors in development
      if (process.env.VITE_DEV_SERVER_URL) {
        console.error(
          'Sentry Error:',
          hint.originalException ?? hint.syntheticException
        );
      }
      return event;
    },

    // Enable debug mode in development
    debug: !!process.env.VITE_DEV_SERVER_URL,

    // Capture additional context
    initialScope: {
      tags: {
        'electron.process': 'main',
      },
    },
  });

  console.log('✅ Sentry initialized for main process');
} else {
  console.warn('⚠️ Sentry DSN not found. Error tracking disabled.');
}

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
  const intervalMs = 30 * 60 * 1000; // 30 minutes
  syncManager = SyncManager.getInstance({
    supabase,
    tables,
    interval: intervalMs,
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
  syncManager.nextSyncTime = new Date(Date.now() + intervalMs);
  setTimeout(() => void syncManager?.start(), 30000);
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
  if (process.env.SYNC_TO_SUPABASE) {
    initSupabase();
  }
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
      Sentry.captureException(error, {
        contexts: {
          operation: {
            name: 'init-seed',
            type: 'ipc-handler',
          },
        },
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }
);

ipcMain.handle(
  'get-sync-info',
  (): ElectronToReactResponse<{
    syncInfo: {
      lastSyncTime: Date | null;
      nextSyncTime: Date | null;
      interval: number;
    } | null;
    isSyncEnabled: string;
  }> => {
    try {
      const syncInfo = syncManager?.getSyncInfo() ?? null;
      return {
        success: true,
        data: {
          isSyncEnabled: process.env.SYNC_TO_SUPABASE ?? 'false',
          syncInfo: syncInfo,
        },
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

// Sync
ipcMain.handle('sync-now', async (): Promise<ElectronToReactResponse<void>> => {
  try {
    return { success: true, data: await syncManager?.pushAll() };
  } catch (error: unknown) {
    Sentry.captureException(error, {
      contexts: {
        operation: {
          name: 'sync-now',
          type: 'ipc-handler',
        },
      },
    });
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
    Sentry.captureException(error, {
      contexts: {
        operation: {
          name: 'is-syncing-now',
          type: 'ipc-handler',
        },
      },
    });
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
      Sentry.captureException(error, {
        contexts: {
          operation: {
            name: 'initial-pull',
            type: 'ipc-handler',
          },
        },
      });
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
      Sentry.captureException(error, {
        contexts: {
          operation: {
            name: 'db:create',
            table,
            type: 'ipc-handler',
            arg: record,
          },
        },
      });
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
      Sentry.captureException(error, {
        contexts: {
          operation: {
            name: 'db:read',
            table,
            type: 'ipc-handler',
            arg: conditions,
          },
        },
      });
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
      Sentry.captureException(error, {
        contexts: {
          operation: {
            name: 'db:update',
            table,
            type: 'ipc-handler',
            arg: record,
          },
        },
      });
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
      Sentry.captureException(error, {
        contexts: {
          operation: {
            name: 'db:delete',
            table,
            type: 'ipc-handler',
            arg: record,
          },
        },
      });
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
      Sentry.captureException(error, {
        contexts: {
          operation: {
            name: 'db:query',
            query,
            type: 'ipc-handler',
            arg: { query, params },
          },
        },
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }
);
