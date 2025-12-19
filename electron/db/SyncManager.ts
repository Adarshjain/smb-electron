import { type SupabaseClient } from '@supabase/supabase-js';
import { create, deleteSynced, fetchUnsynced, markAsSynced } from './localDB';
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
    this.timer = setInterval(() => void this.pushAll(), this.interval);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async pushAll() {
    if (this.running) return;
    this.running = true;
    this.onBackupStart?.();

    const summary: Record<string, number> = {};

    try {
      for (const tableName of this.tables) {
        await this.pushChanges(tableName);
      }
      this.lastSyncTime = new Date();
      this.scheduleNextSync();
      this.onBackupEnd?.({ status: true, summary });
    } catch (error) {
      this.onBackupEnd?.({
        status: false,
        error: error instanceof Error ? [error.message] : ['Unknown error'],
      });
      throw error;
    } finally {
      this.running = false;
    }
  }

  private async pushChanges<K extends TableName>(tableName: K): Promise<void> {
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

        upsertRecords.forEach((record) => markAsSynced(tableName, record));
      }
    } catch (error) {
      console.error(`Error syncing ${tableName}:`, error);
      throw error;
    }
  }

  async initialPull() {
    console.log('⬇️ Performing initial pull from Supabase...');
    for (const tableName of this.tables) {
      const { data, error } = await this.supabase.from(tableName).select('*');
      if (error) throw error;

      if (!data?.length) {
        console.warn(`No data fetched for table ${tableName}`);
        continue;
      }
      data.forEach((record) =>
        create(tableName, {
          ...record,
          synced: 1,
        } as unknown as LocalTables<TableName>)
      );
    }
    console.log('✅ Initial data pull complete.');
  }
}
