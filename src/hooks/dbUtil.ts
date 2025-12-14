import type {
  LocalTables,
  TableName,
  Tables,
  TablesUpdate,
} from '../../tables';
import type { ElectronToReactResponse } from '../../shared-types';

export const create = async <K extends TableName>(
  table: K,
  record: Tables[K]
): Promise<null> => {
  const createResponse: ElectronToReactResponse<null> =
    await window.api.db.create(table, record);
  if (createResponse.success) {
    return null;
  }
  throw new Error(createResponse.error);
};

export const read = async <K extends TableName>(
  table: K,
  conditions: Partial<LocalTables<K>>,
  fields: keyof LocalTables<K> | '*' = '*',
  isLikeQuery = false
): Promise<LocalTables<K>[] | null> => {
  const readResponse = await window.api.db.read(
    table,
    conditions,
    fields,
    isLikeQuery
  );
  if (readResponse.success) {
    return readResponse.data ?? null;
  }
  throw new Error(readResponse.error);
};

export const update = async <K extends TableName>(
  table: K,
  record: TablesUpdate[K]
): Promise<null> => {
  const updateResponse = await window.api.db.update(table, record);
  if (updateResponse.success) {
    return null;
  }
  throw new Error(updateResponse.error);
};

export const deleteRecord = async <K extends TableName>(
  table: K,
  record: Partial<Tables[K]>
): Promise<null> => {
  const response = await window.api.db.delete(table, record);
  if (response.success) {
    return null;
  }
  throw new Error(response.error);
};

export const query = async <T>(
  query: string,
  params?: unknown[],
  justRun = false
): Promise<T | null> => {
  const response = await window.api.db.query(query, params, justRun);
  if (response.success) {
    return (response.data as T) ?? null;
  }
  throw new Error(response.error);
};

// Execute multiple queries in a single IPC call - much faster than multiple query() calls
export const batchQuery = async <T extends unknown[][]>(
  queries: { sql: string; params?: unknown[]; justRun?: boolean }[]
): Promise<T> => {
  const response = await window.api.db.batch(queries);
  if (response.success) {
    return (response.data as T) ?? ([] as unknown as T);
  }
  throw new Error(response.error);
};
