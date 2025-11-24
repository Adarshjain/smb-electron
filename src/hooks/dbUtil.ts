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
  throw new Error(createResponse.error, {
    cause: createResponse.stack,
  });
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
  throw new Error(readResponse.error, {
    cause: readResponse.stack,
  });
};

export const update = async <K extends TableName>(
  table: K,
  record: TablesUpdate[K]
): Promise<null> => {
  const updateResponse = await window.api.db.update(table, record);
  if (updateResponse.success) {
    return null;
  }
  throw new Error(updateResponse.error, {
    cause: updateResponse.stack,
  });
};

export const deleteRecord = async <K extends TableName>(
  table: K,
  record: Partial<Tables[K]>
): Promise<null> => {
  const response = await window.api.db.delete(table, record);
  if (response.success) {
    return null;
  }
  throw new Error(response.error, {
    cause: response.stack,
  });
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
  throw new Error(response.error, {
    cause: response.stack,
  });
};
