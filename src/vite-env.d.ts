import { type LocalTables, type TableName, type Tables } from '../tables';
import { type ElectronToReactResponse } from '../shared-types';

declare global {
  interface Window {
    api: {
      db: {
        create: <K extends TableName>(
          table: K,
          record: Tables[K]['Row']
        ) => Promise<ElectronToReactResponse<null>>;
        read: <K extends TableName>(
          table: K,
          conditions: Partial<LocalTables<K>>,
          fields: keyof LocalTables<K> | '*' = '*',
          isLikeQuery?: boolean
        ) => Promise<ElectronToReactResponse<LocalTables<K>[] | null>>;
        update: <K extends TableName>(
          table: K,
          record: Tables[K]['Update']
        ) => Promise<ElectronToReactResponse<null>>;
        delete: <K extends TableName>(
          table: K,
          record: Tables[K]['Delete']
        ) => Promise<ElectronToReactResponse<null>>;
        query: <T>(
          query: string,
          params?: unknown[],
          justRun?: boolean
        ) => Promise<ElectronToReactResponse<T | null>>;
        initSeed: () => Promise<ElectronToReactResponse<void>>;
      };
      supabase: {
        sync: () => Promise<ElectronToReactResponse<void>>;
        isSyncing: () => Promise<ElectronToReactResponse<boolean | undefined>>;
        initialPull: () => Promise<ElectronToReactResponse<void | undefined>>;
        onSyncStatus: (
          callback: (
            data:
              | { status: 'started' }
              | {
                  status: 'ended';
                  lastSync: number;
                  errors: string[];
                }
          ) => void
        ) => void;
      };
    };
  }
}
