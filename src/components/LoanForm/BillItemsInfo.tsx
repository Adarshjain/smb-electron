import type { Tables } from '@/../tables';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.tsx';

export default function BillItemsInfo(props: {
  items: Tables['bill_items'][];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="border-r">Items</TableHead>
          <TableHead className="border-r">Qty</TableHead>
          <TableHead className="text-right">Weight</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.items.map((bill) => (
          <TableRow
            key={`${bill.serial}-${bill.loan_no}${bill.quality} ${bill.product} ${bill.extra}`}
          >
            <TableCell className="border-r">{`${bill.quality} ${bill.product} ${bill.extra}`}</TableCell>
            <TableCell className="border-r">{bill.quantity}</TableCell>
            <TableCell className="text-right">
              {bill.gross_weight.toFixed(3)} gms
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
