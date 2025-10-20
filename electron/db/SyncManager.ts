import {SupabaseClient} from '@supabase/supabase-js'
import {create, fetchUnsynced, markAsSynced} from './localDB'
import {LocalTables, TableNames} from "../../tables";

export type BackupEndResponse = {
    status: true;
    summary: Record<string, number>
} | {
    status: false;
    error: string[]
}

interface SyncConfig {
    supabase: SupabaseClient
    tables: TableNames[]
    interval?: number // milliseconds
    onBackupStart?: () => void
    onBackupEnd?: (response: BackupEndResponse) => void
}

export class SyncManager {
    private static instance: SyncManager | null = null
    private supabase: SupabaseClient
    private readonly tables: TableNames[]
    private readonly interval: number
    private timer?: NodeJS.Timeout
    private running = false
    private readonly onBackupStart?: () => void
    private readonly onBackupEnd?: (response: BackupEndResponse) => void

    private constructor(config: SyncConfig) {
        this.supabase = config.supabase
        this.tables = config.tables
        this.interval = config.interval ?? 5 * 60 * 1000
        this.onBackupStart = config.onBackupStart
        this.onBackupEnd = config.onBackupEnd
    }

    static getInstance(config?: SyncConfig): SyncManager {
        if (!SyncManager.instance) {
            if (!config) {
                throw new Error('SyncManager must be initialized with config first')
            }
            SyncManager.instance = new SyncManager(config)
        }
        return SyncManager.instance
    }

    static resetInstance() {
        if (SyncManager.instance) {
            SyncManager.instance.stop()
            SyncManager.instance = null
        }
    }

    get isRunning() {
        return this.running
    }

    async start() {
        await this.pushAll()
        this.timer = setInterval(() => this.pushAll(), this.interval)
    }

    stop() {
        if (this.timer) clearInterval(this.timer)
    }

    async pushAll() {
        if (this.running) return
        this.running = true
        this.onBackupStart?.()

        const summary: Record<string, number> = {}

        try {
            for (const tableName of this.tables) {
                await this.pushChanges(tableName)
            }
            this.onBackupEnd?.({status: true, summary})
        } catch (error) {
            this.onBackupEnd?.({status: false, error: error instanceof Error ? [error.message] : ['Unknown error']})
        } finally {
            this.running = false
        }
    }

    private async pushChanges<K extends TableNames>(tableName: K): Promise<void> {
        try {
            const unsynced: LocalTables<K>[] | null = fetchUnsynced(tableName);

            if (unsynced == null) {
                console.warn(`DB not initialized`);
                return;
            }

            if (!unsynced.length) return;
            const cleanRecords = unsynced.map(record => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const {synced, ...rest} = record
                return rest
            })
            console.log('Records to sync', tableName, cleanRecords.length)

            const {error} = await this.supabase.from(tableName).upsert(cleanRecords)
            if (error) throw error

            unsynced.forEach(record => markAsSynced(tableName, record));
        } catch (error) {
            console.error(`Error syncing ${tableName}:`, error)
            throw error
        }
    }

    async initialPull() {
        console.log('⬇️ Performing initial pull from Supabase...');
        for (const tableName of this.tables) {
            const {data, error} = await this.supabase.from(tableName).select('*')
            if (error) throw error

            if (data == null || !data.length) {
                console.warn(`No data fetched for table ${tableName}`);
                continue;
            }
            data.forEach(
                record => create(tableName, {...record, synced: 1} as unknown as LocalTables<TableNames>)
            )
        }
        console.log('✅ Initial data pull complete.')
    }
}
