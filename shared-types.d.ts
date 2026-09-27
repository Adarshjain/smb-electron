// Shared types between electron backend and React frontend

import type { LocalTables, TableName, Tables, TablesUpdate } from './tables';

export type ElectronToReactResponse<T> =
  | {
      success: true;
      data?: T;
    }
  | {
      success: false;
      error: string;
      stack: string | undefined;
    };

export interface VerifyRowDiff {
  key: string;
  columns: { column: string; local: unknown; remote: unknown }[];
}

export interface VerifyTableReport {
  table: TableName;
  status: 'match' | 'mismatch' | 'error';
  error?: string;
  localCount: number;
  remoteCount: number;
  // Rows still waiting to be backed up after the backup step ran.
  pendingCount: number;
  localHash: string;
  remoteHash: string;
  // Keys of the affected rows, e.g. "serial=A, loan_no=12".
  missingOnSupabase: string[];
  missingLocally: string[];
  different: VerifyRowDiff[];
  duplicateLocalKeys: number;
  duplicateRemoteKeys: number;
  missingRemoteColumns: string[];
}

export interface BackupVerifyReport {
  startedAt: string;
  finishedAt: string;
  backup: { ok: true } | { ok: false; error: string };
  tables: VerifyTableReport[];
  inSync: boolean;
}

export type BackupVerifyProgress =
  | { step: 'backup' }
  | { step: 'table'; table: TableName; index: number; total: number };

export type RestoreProgress =
  | { step: 'check' | 'write' | 'verify' }
  | { step: 'download'; table: TableName; index: number; total: number };

export interface RestoreReport {
  rowsRestored: number;
  // Written rows compared against the downloaded Supabase rows.
  tables: VerifyTableReport[];
  inSync: boolean;
}

declare global {
  interface Window {
    api: {
      db: {
        create: <K extends TableName>(
          table: K,
          record: Tables[K]
        ) => Promise<ElectronToReactResponse<null>>;
        createDailyEntries: (
          date: string,
          company: string,
          pairs: {
            main_code: number;
            sub_code: number;
            credit: number;
            debit: number;
            description: string | null;
          }[]
        ) => Promise<ElectronToReactResponse<null>>;
        dedupeDailyEntries: (opts: {
          dryRun?: boolean;
          addUniqueIndex?: boolean;
        }) => Promise<
          ElectronToReactResponse<{
            dryRun: boolean;
            duplicateGroups: number;
            pairsKept: number;
            pairsMoved: number;
            rowsAffected: number;
            orphans: Array<{
              date: string;
              company: string;
              sort_order: number;
              main_code: number;
              sub_code: number;
              description: string | null;
            }>;
            movedAssignments: Array<{
              date: string;
              company: string;
              fromSortOrder: number;
              toSortOrder: number;
              description: string | null;
              main_code: number;
              sub_code: number;
            }>;
            uniqueIndexCreated: boolean;
            uniqueIndexSkippedReason?: string;
          }>
        >;
        upsert: <K extends TableName>(
          table: K,
          record: Tables[K]
        ) => Promise<ElectronToReactResponse<null>>;
        read: <K extends TableName>(
          table: K,
          conditions: Partial<LocalTables<K>>,
          fields: keyof LocalTables<K> | '*' = '*',
          isLikeQuery?: boolean
        ) => Promise<ElectronToReactResponse<LocalTables<K>[] | null>>;
        update: <K extends TableName>(
          table: K,
          record: TablesUpdate[K]
        ) => Promise<ElectronToReactResponse<null>>;
        delete: <K extends TableName>(
          table: K,
          record: Partial<Tables[K]>
        ) => Promise<ElectronToReactResponse<null>>;
        query: <T>(
          query: string,
          params?: unknown[],
          justRun?: boolean
        ) => Promise<ElectronToReactResponse<T | null>>;
        batch: (
          queries: { sql: string; params?: unknown[]; justRun?: boolean }[]
        ) => Promise<ElectronToReactResponse<unknown[][]>>;
        initSeed: () => Promise<ElectronToReactResponse<void>>;
      };
      supabase: {
        sync: () => Promise<ElectronToReactResponse<void>>;
        syncTable: (
          tableName: TableName
        ) => Promise<ElectronToReactResponse<void>>;
        isSyncing: () => Promise<ElectronToReactResponse<boolean>>;
        restore: () => Promise<ElectronToReactResponse<RestoreReport>>;
        onRestoreProgress: (
          callback: (progress: RestoreProgress) => void
        ) => () => void;
        verifyBackup: () => Promise<
          ElectronToReactResponse<BackupVerifyReport>
        >;
        onVerifyProgress: (
          callback: (progress: BackupVerifyProgress) => void
        ) => () => void;
        getSyncInfo: () => Promise<
          ElectronToReactResponse<{
            syncInfo: {
              lastSyncTime: Date | null;
              nextSyncTime: Date | null;
              interval: number;
            } | null;
            isSyncEnabled: string;
          }>
        >;
        onSyncStatus: (
          callback: (
            data:
              | { state: 'started' }
              | {
                  state: 'ended';
                  success: boolean;
                  message?: string;
                  error?: string;
                }
          ) => void
        ) => void;
      };
    };
  }
}
