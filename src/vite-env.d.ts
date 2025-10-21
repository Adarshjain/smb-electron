import {LocalTables, TableNames, Tables} from "../tables";
import {ElectronToReactResponse} from "../electron/main.ts";

declare global {
    interface Window {
        api: {
            db: {
                create: <K extends TableNames>(table: K, record: Tables[K]['Row']) => Promise<ElectronToReactResponse<null>>;
                read: <K extends TableNames>(
                    table: K,
                    conditions: Partial<LocalTables<K>>,
                    fields: keyof LocalTables<K> | '*' = '*'
                )=> Promise<ElectronToReactResponse<LocalTables<K>[] | null>>;
                update: <K extends TableNames>(
                    table: K,
                    record: Tables[K]['Update']
                )=> Promise<ElectronToReactResponse<null>>;
                delete: <K extends TableNames>(
                    table: K,
                    record: Tables[K]['Delete']
                )=> Promise<ElectronToReactResponse<null>>;
                query: <T>(query: string, params?: unknown[])=> Promise<ElectronToReactResponse<T | null>>;
                initSeed: () => Promise<ElectronToReactResponse<void>>;
            },
            supabase: {
                sync: () => Promise<ElectronToReactResponse<void>>;
                isSyncing: () => Promise<ElectronToReactResponse<boolean | undefined>>;
                initialPull: () => Promise<ElectronToReactResponse<void | undefined>>;
                onSyncStatus: (callback: (data: { status: 'started' } | {
                    status: 'ended',
                    lastSync: number,
                    errors: string[]
                }) => void) => void;
            }
        };
    }
}
