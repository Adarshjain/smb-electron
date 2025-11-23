import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';
import type { TableName } from '../../tables';
import { TablesSQliteSchema } from '../../tableSchema.ts';
import DataView from '@/components/DataView.tsx';
import GoHome from '@/components/GoHome.tsx';

export function TableView() {
  const [currentTable, setCurrentTable] = useState<TableName>('companies');
  const allTables = Object.keys(TablesSQliteSchema) as TableName[];
  return (
    <div className="pt-4">
      <div className="flex ml-6">
        <GoHome />
        <Select
          onValueChange={(value) => setCurrentTable(value as TableName)}
          value={currentTable}
        >
          <SelectTrigger className="w-[200px] ml-4">
            <SelectValue placeholder="Select Table" />
          </SelectTrigger>
          <SelectContent>
            {allTables.map((table) => (
              <SelectItem key={table} value={table}>
                {table}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataView className="p-4" table={currentTable} key={currentTable} />
    </div>
  );
}
