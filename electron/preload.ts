import { contextBridge, ipcRenderer } from 'electron';
import {
  type LocalTables,
  type TableName,
  type TablesDelete,
  type TablesUpdate,
} from '../tables';
import { type ElectronToReactResponse } from '../shared-types';
import { type BackupEndResponse } from './db/SyncManager';

contextBridge.exposeInMainWorld('api', {
  db: {
    create: <K extends TableName>(
      table: K,
      record: LocalTables<K>
    ): Promise<ElectronToReactResponse<null>> =>
      ipcRenderer.invoke('db:create', table, record),
    read: <K extends TableName>(
      table: K,
      conditions: Partial<LocalTables<K>>,
      fields: keyof LocalTables<K> | '*' = '*',
      isLikeQuery?: boolean
    ): Promise<ElectronToReactResponse<LocalTables<K>[] | null>> =>
      ipcRenderer.invoke('db:read', table, conditions, fields, isLikeQuery),
    update: <K extends TableName>(
      table: K,
      record: TablesUpdate[K]
    ): Promise<ElectronToReactResponse<null>> =>
      ipcRenderer.invoke('db:update', table, record),
    delete: <K extends TableName>(
      table: K,
      record: TablesDelete[K]
    ): Promise<ElectronToReactResponse<null>> =>
      ipcRenderer.invoke('db:delete', table, record),
    query: (
      query: string,
      params?: unknown[],
      justRun?: boolean
    ): Promise<ElectronToReactResponse<unknown>> =>
      ipcRenderer.invoke('db:query', query, params, justRun),
    initSeed: (): Promise<ElectronToReactResponse<void>> =>
      ipcRenderer.invoke('init-seed'),
  },
  supabase: {
    sync: (): Promise<ElectronToReactResponse<void>> =>
      ipcRenderer.invoke('sync-now'),
    isSyncing: (): Promise<ElectronToReactResponse<boolean | undefined>> =>
      ipcRenderer.invoke('is-syncing-now'),
    initialPull: (): Promise<ElectronToReactResponse<void | undefined>> =>
      ipcRenderer.invoke('initial-pull'),
    onSyncStatus: (
      callback: (data: { state: 'started' } | BackupEndResponse) => void
    ) => {
      ipcRenderer.on(
        'sync-status',
        (_, data: { state: 'started' } | BackupEndResponse) => callback(data)
      );
    },
  },
});
