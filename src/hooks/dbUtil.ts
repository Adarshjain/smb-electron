import type { LocalTables, TableName, Tables } from '../../tables';
import type { ElectronToReactResponse } from '../../electron/main.ts';

export const create = async <K extends TableName>(
  table: K,
  record: Tables[K]['Row']
): Promise<ElectronToReactResponse<null>> =>
  window.api.db.create(table, record);

export const read = async <K extends TableName>(
  table: K,
  conditions: Partial<LocalTables<K>>,
  fields: keyof LocalTables<K> | '*' = '*'
): Promise<ElectronToReactResponse<LocalTables<K>[] | null>> =>
  window.api.db.read(table, conditions, fields);

export const update = async <K extends TableName>(
  table: K,
  record: Tables[K]['Update']
): Promise<ElectronToReactResponse<null>> =>
  window.api.db.update(table, record);

export const deleteRecord = async <K extends TableName>(
  table: K,
  record: Tables[K]['Delete']
): Promise<ElectronToReactResponse<null>> =>
  window.api.db.delete(table, record);

export const query = async <T>(
  query: string,
  params?: unknown[]
): Promise<ElectronToReactResponse<T | null>> =>
  window.api.db.query(query, params);
