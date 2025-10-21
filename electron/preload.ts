import {contextBridge, ipcRenderer} from 'electron';
import {LocalTables, TableName, Tables} from "../tables";
import {ElectronToReactResponse} from "../shared-types";

contextBridge.exposeInMainWorld('api', {
    db: {
        create: <K extends TableName>(
            table: K,
            record: Tables[K]['Row']
        ): Promise<ElectronToReactResponse<null>> =>
            ipcRenderer.invoke('db:create', table, record),
        read: <K extends TableName>(
            table: K,
            conditions: Partial<LocalTables<K>>,
            fields: keyof LocalTables<K> | '*' = '*'
        ): Promise<ElectronToReactResponse<LocalTables<K>[] | null>> =>
            ipcRenderer.invoke('db:read', table, conditions, fields),
        update: <K extends TableName>(
            table: K,
            record: Tables[K]['Update']
        ): Promise<ElectronToReactResponse<null>> =>
            ipcRenderer.invoke('db:update', table, record),
        delete: <K extends TableName>(
            table: K,
            record: Tables[K]['Delete']
        ): Promise<ElectronToReactResponse<null>> =>
            ipcRenderer.invoke('db:delete', table, record),
        query: (query: string, params?: unknown[]): Promise<ElectronToReactResponse<unknown | null>> =>
            ipcRenderer.invoke('db:query', query, params),
        initSeed: (): Promise<ElectronToReactResponse<void>> => ipcRenderer.invoke('init-seed'),
    },
    supabase: {
        sync: (): Promise<ElectronToReactResponse<void>> => ipcRenderer.invoke('sync-now'),
        isSyncing: (): Promise<ElectronToReactResponse<boolean | undefined>> => ipcRenderer.invoke('is-syncing-now'),
        initialPull: (): Promise<ElectronToReactResponse<void | undefined>> => ipcRenderer.invoke('initial-pull'),
        onSyncStatus: (callback: (data: { status: 'started' } | {
            status: 'ended',
            lastSync: number,
            errors: string[]
        }) => void) => {
            ipcRenderer.on('sync-status', (_, data) => callback(data));
        },
    }
});
