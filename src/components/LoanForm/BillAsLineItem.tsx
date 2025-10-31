import { useEffect, useState } from 'react';
import {
  fetchBillsByCustomer,
  getInterest,
  mergeBillItems,
  monthDiff,
  viewableDate,
} from '@/lib/myUtils.tsx';
import type { Tables } from '../../../tables';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.tsx';

export default function BillAsLineItem(props: { customerId: string }) {
  const [bills, setBills] = useState<Tables['full_bill']['Row'][]>([]);
  useEffect(() => {
    const run = async () => {
      setBills((await fetchBillsByCustomer(props.customerId)) ?? []);
    };
    void run();
  }, [props.customerId]);
  if (!bills.length) {
    return null;
  }

  return (
    <div className="border rounded-md">
      <Table className="table-auto">
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap w-[1%] px-3 py-1 h-6 rounded-tl border-r">
              Loan No
            </TableHead>
            <TableHead className="whitespace-nowrap w-[1%] px-3 py-1 h-6 border-r">
              Date
            </TableHead>
            <TableHead className="whitespace-nowrap w-[1%] px-3 py-1 h-6 text-right border-r">
              Amount
            </TableHead>
            <TableHead className="whitespace-nowrap w-[1%] px-3 py-1 h-6 text-right border-r">
              Interest
            </TableHead>
            <TableHead className="whitespace-nowrap w-[1%] px-3 py-1 h-6 text-right border-r">
              Total
            </TableHead>
            <TableHead className="whitespace-nowrap w-[1%] px-3 py-1 h-6 border-r">
              Items
            </TableHead>
            <TableHead className="whitespace-nowrap w-[1%] px-3 py-1 h-6 text-right">
              Weight
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((bill) => {
            const interest = getInterest(
              bill.loan_amount,
              bill.interest_rate,
              monthDiff(bill.date)
            );
            const { description, weight } = mergeBillItems(bill.bill_items);
            return (
              <TableRow key={`${bill.serial}-${bill.loan_no}`}>
                <TableCell className="rounded-bl border-r">{`${bill.serial} ${bill.loan_no}`}</TableCell>
                <TableCell className="border-r tabular-nums">
                  {viewableDate(bill.date)}
                </TableCell>
                <TableCell className="text-right border-r tabular-nums">
                  ₹{bill.loan_amount.toFixed(2)}
                </TableCell>
                <TableCell className="text-right border-r tabular-nums">
                  ₹{interest.toFixed(2)}
                </TableCell>
                <TableCell className="text-right border-r tabular-nums">
                  ₹{(interest + bill.loan_amount).toFixed(2)}
                </TableCell>
                <TableCell className="border-r">{description}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {weight.toFixed(2)} gms
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
