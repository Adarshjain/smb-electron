import type {
  LocalTables,
  TableName,
  Tables,
  TablesUpdate,
} from '../../tables';
import type {
  ElectronToReactResponse,
  LoanKey,
  SaveLoanInput,
} from '../../shared-types';

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

export interface DailyEntryPair {
  main_code: number;
  sub_code: number;
  credit: number;
  debit: number;
  description: string | null;
}

export const createDailyEntries = async (
  date: string,
  company: string,
  pairs: DailyEntryPair[]
): Promise<null> => {
  const response = await window.api.db.createDailyEntries(date, company, pairs);
  if (response.success) {
    return null;
  }
  throw new Error(response.error);
};

export const deleteDailyEntry = async (
  date: string,
  company: string,
  sort_order: number,
  main_code: number,
  sub_code: number
): Promise<null> => {
  const response = await window.api.db.deleteDailyEntry(
    date,
    company,
    sort_order,
    main_code,
    sub_code
  );
  if (response.success) {
    return null;
  }
  throw new Error(response.error);
};

export const updateDailyEntry = async (
  date: string,
  company: string,
  sort_order: number,
  old_sub_code: number,
  pair: DailyEntryPair
): Promise<null> => {
  const response = await window.api.db.updateDailyEntry(
    date,
    company,
    sort_order,
    old_sub_code,
    pair
  );
  if (response.success) {
    return null;
  }
  throw new Error(response.error);
};

export const releaseLoan = async (
  release: Tables['releases']
): Promise<null> => {
  const response = await window.api.db.releaseLoan(release);
  if (response.success) {
    return null;
  }
  throw new Error(response.error);
};

export const unreleaseLoan = async (
  serial: string,
  loan_no: number
): Promise<null> => {
  const response = await window.api.db.unreleaseLoan(serial, loan_no);
  if (response.success) {
    return null;
  }
  throw new Error(response.error);
};

export const renameArea = async (
  oldName: string,
  newName: string
): Promise<null> => {
  const response = await window.api.db.renameArea(oldName, newName);
  if (response.success) {
    return null;
  }
  throw new Error(response.error);
};

export const saveLoan = async (input: SaveLoanInput): Promise<null> => {
  const response = await window.api.db.saveLoan(input);
  if (response.success) {
    return null;
  }
  throw new Error(response.error);
};

export const deleteLoan = async (loan: LoanKey): Promise<null> => {
  const response = await window.api.db.deleteLoan(loan);
  if (response.success) {
    return null;
  }
  throw new Error(response.error);
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
