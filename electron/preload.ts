import { contextBridge, ipcRenderer } from 'electron';
import {
  type LocalTables,
  type TableName,
  type Tables,
  type TablesDelete,
  type TablesUpdate,
} from '../tables';
import {
  type BackupVerifyProgress,
  type BackupVerifyReport,
  type ElectronToReactResponse,
  type LoanKey,
  type RestoreProgress,
  type RestoreReport,
  type SaveLoanInput,
  type SyncStatusEvent,
} from '../shared-types';
import { type DailyEntryPair } from './db/localDB';

contextBridge.exposeInMainWorld('api', {
  db: {
    create: <K extends TableName>(
      table: K,
      record: LocalTables<K>
    ): Promise<ElectronToReactResponse<null>> =>
      ipcRenderer.invoke('db:create', table, record),
    createDailyEntries: (
      date: string,
      company: string,
      pairs: DailyEntryPair[]
    ): Promise<ElectronToReactResponse<null>> =>
      ipcRenderer.invoke('db:create-daily-entries', date, company, pairs),
    updateDailyEntry: (
      date: string,
      company: string,
      sort_order: number,
      old_sub_code: number,
      pair: DailyEntryPair
    ): Promise<ElectronToReactResponse<null>> =>
      ipcRenderer.invoke(
        'db:update-daily-entry',
        date,
        company,
        sort_order,
        old_sub_code,
        pair
      ),
    releaseLoan: (
      release: Tables['releases']
    ): Promise<ElectronToReactResponse<null>> =>
      ipcRenderer.invoke('db:release-loan', release),
    unreleaseLoan: (
      serial: string,
      loan_no: number
    ): Promise<ElectronToReactResponse<null>> =>
      ipcRenderer.invoke('db:unrelease-loan', serial, loan_no),
    saveLoan: (input: SaveLoanInput): Promise<ElectronToReactResponse<null>> =>
      ipcRenderer.invoke('db:save-loan', input),
    deleteLoan: (loan: LoanKey): Promise<ElectronToReactResponse<null>> =>
      ipcRenderer.invoke('db:delete-loan', loan),
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
    // Batch multiple queries in a single IPC call
    batch: (
      queries: { sql: string; params?: unknown[]; justRun?: boolean }[]
    ): Promise<ElectronToReactResponse<unknown[][]>> =>
      ipcRenderer.invoke('db:batch', queries),
    initSeed: (): Promise<ElectronToReactResponse<void>> =>
      ipcRenderer.invoke('init-seed'),
  },
  supabase: {
    sync: (): Promise<ElectronToReactResponse<void>> =>
      ipcRenderer.invoke('sync-now'),
    syncTable: (tableName: TableName): Promise<ElectronToReactResponse<void>> =>
      ipcRenderer.invoke('sync-table-now', tableName),
    isSyncing: (): Promise<ElectronToReactResponse<boolean>> =>
      ipcRenderer.invoke('is-syncing-now'),
    restore: (): Promise<ElectronToReactResponse<RestoreReport>> =>
      ipcRenderer.invoke('restore-from-supabase'),
    onRestoreProgress: (callback: (progress: RestoreProgress) => void) => {
      const listener = (_: unknown, progress: RestoreProgress) =>
        callback(progress);
      ipcRenderer.on('restore-progress', listener);
      return () => {
        ipcRenderer.removeListener('restore-progress', listener);
      };
    },
    verifyBackup: (): Promise<ElectronToReactResponse<BackupVerifyReport>> =>
      ipcRenderer.invoke('verify-backup'),
    onVerifyProgress: (callback: (progress: BackupVerifyProgress) => void) => {
      const listener = (_: unknown, progress: BackupVerifyProgress) =>
        callback(progress);
      ipcRenderer.on('verify-backup-progress', listener);
      return () => {
        ipcRenderer.removeListener('verify-backup-progress', listener);
      };
    },
    getSyncInfo: (): Promise<
      ElectronToReactResponse<{
        syncInfo: {
          lastSyncTime: Date | null;
          nextSyncTime: Date | null;
          interval: number;
        } | null;
        isSyncEnabled: string;
      }>
    > => ipcRenderer.invoke('get-sync-info'),
    onSyncStatus: (callback: (data: SyncStatusEvent) => void) => {
      ipcRenderer.on('sync-status', (_, data: SyncStatusEvent) =>
        callback(data)
      );
    },
  },
});
