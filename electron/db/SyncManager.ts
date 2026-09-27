import { type SupabaseClient } from '@supabase/supabase-js';
import {
  deleteSynced,
  fetchUnsynced,
  markAsSynced,
  setRemoteSortOrderFloor,
} from './localDB';
import type { LocalTables, TableName } from '../../tables';
import { TablesSQliteSchema } from '../../tableSchema';

export type BackupEndResponse =
  | {
      status: true;
      summary: Record<string, number>;
    }
  | {
      status: false;
      error: string[];
    };

interface SyncConfig {
  supabase: SupabaseClient;
  tables: TableName[];
  interval?: number; // milliseconds
  onBackupStart?: () => void;
  onBackupEnd?: (response: BackupEndResponse) => void;
}

// Supabase errors are plain objects, not Error instances.
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const { message, details } = (error ?? {}) as {
    message?: unknown;
    details?: unknown;
  };
  if (typeof message !== 'string') return JSON.stringify(error);
  return typeof details === 'string' && details
    ? `${message} (${details})`
    : message;
}

export class SyncManager {
  private static instance: SyncManager | null = null;
  private supabase: SupabaseClient;
  private readonly tables: TableName[];
  private readonly interval: number;
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly onBackupStart?: () => void;
  private readonly onBackupEnd?: (response: BackupEndResponse) => void;
  private lastSyncTime: Date | null = null;
  nextSyncTime: Date | null = null;

  private constructor(config: SyncConfig) {
    this.supabase = config.supabase;
    this.tables = config.tables;
    this.interval = config.interval ?? 5 * 60 * 1000;
    this.onBackupStart = config.onBackupStart;
    this.onBackupEnd = config.onBackupEnd;
  }

  static getInstance(config?: SyncConfig): SyncManager {
    if (!SyncManager.instance) {
      if (!config) {
        throw new Error('SyncManager must be initialized with config first');
      }
      SyncManager.instance = new SyncManager(config);
    }
    return SyncManager.instance;
  }

  static resetInstance() {
    if (SyncManager.instance) {
      SyncManager.instance.stop();
      SyncManager.instance = null;
    }
  }

  get isRunning() {
    return this.running;
  }

  get client() {
    return this.supabase;
  }

  getSyncInfo() {
    return {
      lastSyncTime: this.lastSyncTime,
      nextSyncTime: this.nextSyncTime,
      interval: this.interval,
    };
  }

  async start() {
    try {
      await this.pushAll();
      this.scheduleNextSync();
    } catch (error) {
      console.error(error);
    }
  }

  private scheduleNextSync() {
    if (this.timer) clearInterval(this.timer);
    this.nextSyncTime = new Date(Date.now() + this.interval);
    // Failures are already reported through onBackupEnd.
    this.timer = setInterval(
      () => void this.pushAll().catch(() => undefined),
      this.interval
    );
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async pushAll() {
    if (this.running) return;
    this.running = true;
    this.onBackupStart?.();

    const summary: Record<string, number> = {};
    // One table failing (a bad row, say) must not stop the others from
    // being backed up, so each step's failure is collected and reported
    // together at the end.
    const errors: string[] = [];
    const attempt = async (label: string, task: () => Promise<void>) => {
      try {
        await task();
      } catch (error) {
        errors.push(`${label}: ${errorMessage(error)}`);
      }
    };

    try {
      await attempt('reading the highest entry number', () =>
        this.refreshSortOrderFloor()
      );
      for (const tableName of this.tables) {
        if (tableName === 'daily_entries') {
          continue;
        }
        await attempt(tableName, () => this.pushChanges(tableName));
      }
      await attempt('daily_entries', () => this.pushChanges('daily_entries'));

      if (errors.length) {
        this.onBackupEnd?.({ status: false, error: errors });
        throw new Error(errors.join('\n'));
      }
      this.lastSyncTime = new Date();
      this.onBackupEnd?.({ status: true, summary });
    } finally {
      this.running = false;
      this.scheduleNextSync();
    }
  }

  // Tells createDailyEntries the highest sort_order Supabase has, so new
  // entries never reuse one even if the local database is behind.
  async refreshSortOrderFloor() {
    const { data, error } = await this.supabase
      .from('daily_entries')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1);
    if (error) throw error;
    setRemoteSortOrderFloor(Number(data[0]?.sort_order ?? 0));
  }

  public async pushChanges<K extends TableName>(tableName: K): Promise<void> {
    try {
      const unsynced: LocalTables<K>[] | null = fetchUnsynced(tableName);

      if (unsynced == null) {
        console.warn(`DB not initialized`);
        return;
      }

      if (!unsynced.length) return;
      const upsertRecords: LocalTables<K>[] = [];
      const deleteRecords: LocalTables<K>[] = [];
      unsynced.forEach((record) => {
        const { synced: _, deleted, ...rest } = record;
        if (deleted) {
          // @ts-expect-error shouldn't ideally
          deleteRecords.push(rest);
        } else {
          // @ts-expect-error shouldn't ideally
          upsertRecords.push(rest);
        }
      });
      console.log(
        'Records to sync',
        tableName,
        'Update:',
        upsertRecords.length,
        '. Delete:',
        deleteRecords.length
      );

      if (deleteRecords.length) {
        const pkFields = TablesSQliteSchema[tableName].primary.filter(
          (key) => key !== 'deleted'
        );

        for (const record of deleteRecords) {
          let deleter = this.supabase.from(tableName).delete();
          for (const field of pkFields) {
            deleter = deleter.eq(field, record[field as keyof LocalTables<K>]);
          }
          const { error: deleteError } = await deleter;
          if (deleteError) throw deleteError;

          deleteSynced(tableName, record);
        }
      }

      if (upsertRecords.length) {
        const { error: upsertError } = await this.supabase
          .from(tableName)
          .upsert(upsertRecords);
        if (upsertError) throw upsertError;

        markAsSynced(tableName, upsertRecords);
      }
    } catch (error) {
      console.error(`Error syncing ${tableName}:`, error);
      throw error;
    }
  }

  // Holds the sync lock while `task` runs, so neither the timer nor the
  // Back Up button can push half-written data.
  async withSyncPaused<T>(task: () => Promise<T>): Promise<T> {
    if (this.running) {
      throw new Error('A backup is running. Try again once it finishes.');
    }
    this.running = true;
    try {
      return await task();
    } finally {
      this.running = false;
    }
  }
}
