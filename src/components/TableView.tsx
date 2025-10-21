import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {useState} from "react";
import type {TableName} from "../../tables";
import {TablesSQliteSchema} from "../../tableSchema.ts";
import DataView from "@/components/DataView.tsx";

export function TableView() {
    const [currentTable, setCurrentTable] = useState<TableName>("companies");
    const allTables = Object.keys(TablesSQliteSchema) as TableName[];
    return <div>
        <Select
            onValueChange={(value) => setCurrentTable(value as TableName)}
            value={currentTable}
        >
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Table"/>
            </SelectTrigger>
            <SelectContent>
                {allTables.map(table => <SelectItem key={table} value={table}>{table}</SelectItem>)}
            </SelectContent>
        </Select>
        <DataView table={currentTable} key={currentTable}/>
    </div>;
}