import { useEffect, useMemo, useState } from 'react';
import { read } from '@/hooks/dbUtil.ts';
import type { TableName, Tables } from '../../tables';
import { rpcError } from '@/lib/myUtils.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { decode } from '@/lib/thanglish/TsciiConverter.ts';
import { Input } from '@/components/ui/input.tsx';
import { useThanglish } from '@/context/ThanglishProvider.tsx';
import { TablesSQliteSchema } from '../../tableSchema.ts';
import { cn } from '@/lib/utils.ts';
import { toast } from 'sonner';

export default function DataView<K extends TableName>(props: {
  table: K;
  hideSearch?: boolean;
  className?: string;
  onRowClick?: (record: Tables[K]['Row']) => void;
}) {
  const [tableData, setTableData] = useState<Tables[K]['Row'][]>([]);
  const [search, setSearch] = useState<string>('');
  const { convert } = useThanglish();

  const columns = useMemo(() => {
    const { synced: _, ...cols } = TablesSQliteSchema[props.table].columns;
    return cols;
  }, [props.table]);

  const primaryKeys = useMemo(
    () => TablesSQliteSchema[props.table].primary,
    [props.table]
  );

  useEffect(() => {
    read(props.table, {})
      .then((response) => {
        if (response.success) {
          setTableData(response.data || []);
        } else {
          rpcError(response);
        }
      })
      .catch(toast.error);
  }, [props.table]);

  const filteredData = useMemo(() => {
    if (!search.trim()) {
      return tableData;
    }
    const lowerSearch = search.toLowerCase();
    return tableData.filter((record: Tables[K]['Row']) =>
      Object.entries(columns).some(([col, conf]) => {
        const val = record[col as keyof Tables[K]['Row']];
        if (val == null) return false;
        // Convert to string before toLowerCase to handle numbers
        const strVal = conf.encoded ? decode(String(val)) : String(val);
        return strVal.toLowerCase().includes(lowerSearch);
      })
    );
  }, [tableData, search, columns]);

  const getRowKey = (record: Tables[K]['Row']): string => {
    return primaryKeys
      .map((key) => String(record[key as keyof Tables[K]['Row']]))
      .join('|');
  };

  return (
    <div className={cn('gap-3 flex flex-col', props.className)}>
      {!props.hideSearch ? (
        <Input
          value={search}
          onInput={(e) =>
            setSearch(convert((e.target as HTMLInputElement).value))
          }
          placeholder="Search..."
        />
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            {Object.keys(columns).map((col) => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.map((record) => (
            <TableRow
              key={getRowKey(record)}
              onClick={() => props.onRowClick?.(record)}
            >
              {Object.entries(record).map(([key, val]) => {
                if (!(key in columns)) return null;
                const value = columns[key].encoded
                  ? decode(String(val))
                  : String(val ?? '');
                return <TableCell key={key}>{value}</TableCell>;
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
