import type {LocalTables, TableNames, Tables} from "../../tables";
import type {ElectronToReactResponse} from "../../electron/main.ts";

export function getDBMethods<K extends TableNames>(table: K) {
    const create =
        async (record: Tables[K]['Row']): Promise<ElectronToReactResponse<null>> => window.api.db.create(table, record)

    const read =
        async (
            conditions: Partial<LocalTables<K>>,
            fields: keyof LocalTables<K> | '*' = '*'
        ): Promise<ElectronToReactResponse<LocalTables<K>[] | null>> => window.api.db.read(table, conditions, fields)

    const update =
        async (record: Tables[K]['Update']): Promise<ElectronToReactResponse<LocalTables<K>[] | null>> =>
            window.api.db.update(table, record)

    const deleteRecord =
        async (record: Tables[K]['Delete']): Promise<ElectronToReactResponse<LocalTables<K>[] | null>> =>
            window.api.db.delete(table, record)

    return {
        create,
        read,
        update,
        deleteRecord,
        query,
    };
}

export const query =
    async <T>(query: string, params?: unknown[]): Promise<ElectronToReactResponse<T | null>> =>
        window.api.db.query(query, params)

