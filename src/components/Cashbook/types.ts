import type { Tables } from '../../../tables';

export interface CashbookRow {
  accountHead: Tables['account_head'] | string | undefined;
  description: string | null;
  credit: number | null;
  debit: number | null;
  sort_order: number;
}

export interface CashbookSpreadSheetProps {
  currentAccountHead: Tables['account_head'] | null;
  accountHeads: Tables['account_head'][];
  entries: Tables['daily_entries'][];
  openingBalance: number;
  date: string;
  onLoadToday: () => Promise<void>;
}
