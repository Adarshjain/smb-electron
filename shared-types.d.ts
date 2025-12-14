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

declare global {
  interface Window {
    api: {
      db: {
        create: <K extends TableName>(
          table: K,
          record: Tables[K]
        ) => Promise<ElectronToReactResponse<null>>;
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
        isSyncing: () => Promise<ElectronToReactResponse<boolean>>;
        initialPull: () => Promise<ElectronToReactResponse<void | undefined>>;
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
