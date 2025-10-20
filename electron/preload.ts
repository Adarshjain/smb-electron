import {contextBridge, ipcRenderer} from 'electron';
import {LocalTables, TableNames, Tables} from "../tables";
import {ElectronToReactResponse} from "./main";

contextBridge.exposeInMainWorld('api', {
    db: {
        create: <K extends TableNames>(
            table: K,
            record: Tables[K]['Row']
        ): Promise<ElectronToReactResponse<null>> =>
            ipcRenderer.invoke('db:create', table, record),
        read: <K extends TableNames>(
            table: K,
            conditions: Partial<LocalTables<K>>,
            fields: keyof LocalTables<K> | '*' = '*'
        ): Promise<ElectronToReactResponse<LocalTables<K>[] | null>> =>
            ipcRenderer.invoke('db:read', table, conditions, fields),
        update: <K extends TableNames>(
            table: K,
            record: Tables[K]['Update']
        ): Promise<ElectronToReactResponse<null>> =>
            ipcRenderer.invoke('db:update', table, record),
        delete: <K extends TableNames>(
            table: K,
            record: Tables[K]['Delete']
        ): Promise<ElectronToReactResponse<null>> =>
            ipcRenderer.invoke('db:delete', table, record),
        query: (query: string, params?: unknown[]): Promise<ElectronToReactResponse<unknown | null>> =>
            ipcRenderer.invoke('db:query', query, params),
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
