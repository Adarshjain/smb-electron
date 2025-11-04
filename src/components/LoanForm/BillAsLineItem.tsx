import { useEffect, useState } from 'react';
import {
  fetchBillsByCustomer,
  getInterest,
  getMonthDiff,
  mergeBillItems,
  viewableDate,
} from '@/lib/myUtils.tsx';
import type { Tables } from '@/../tables';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.tsx';
import { useLoanCalculations } from '@/hooks/useLoanCalculations.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils.ts';

export default function BillAsLineItem(props: { customerId: string }) {
  const [enrichedBills, setEnrichedBills] = useState<
    (Tables['full_bill']['Row'] & {
      months: number;
      interest: number;
      firstMonthInterest: number;
      docCharges: number;
      description: string;
      weight: number;
    })[]
  >([]);
  const [totals, setTotals] = useState({
    principle: 0,
    total: 0,
    interest: 0,
  });

  const { calculateLoanAmounts } = useLoanCalculations();

  useEffect(() => {
    const run = async () => {
      const fetchedBills = await fetchBillsByCustomer(props.customerId);
      if (!fetchedBills) return;

      const tempTotal = { principle: 0, total: 0, interest: 0 };

      // Precompute all async values before rendering
      const processed = await Promise.all(
        fetchedBills.map(async (bill) => {
          const months = getMonthDiff(bill.date);
          const interest = getInterest(
            bill.loan_amount,
            bill.interest_rate,
            months
          );
          const { description, weight } = mergeBillItems(bill.bill_items);
          const { firstMonthInterest, docCharges } =
            (await calculateLoanAmounts(bill.loan_amount, bill.metal_type, {
              customInterestRate: bill.interest_rate,
            })) ?? { firstMonthInterest: 0, docCharges: 0 };

          tempTotal.principle += bill.loan_amount;
          tempTotal.interest += interest;
          tempTotal.total += interest + bill.loan_amount;

          return {
            ...bill,
            months,
            interest,
            firstMonthInterest,
            docCharges,
            description,
            weight,
          };
        })
      );

      setEnrichedBills(processed);
      setTotals(tempTotal);
    };

    void run();
  }, [props.customerId, calculateLoanAmounts]);

  if (!enrichedBills.length) return null;

  return (
    <div className="border rounded-md">
      <Table className="table-auto">
        <TableHeader>
          <TableRow>
            <TableHead className="border-r">Loan No</TableHead>
            <TableHead className="border-r">Date</TableHead>
            <TableHead className="border-r">Months</TableHead>
            <TableHead className="text-right border-r">Amount</TableHead>
            <TableHead className="text-right border-r">Interest</TableHead>
            <TableHead className="text-right border-r">Total</TableHead>
            <TableHead className="border-r">Items</TableHead>
            <TableHead className="text-right border-r">Weight</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enrichedBills.map((bill) => (
            <TableRow key={`${bill.serial}-${bill.loan_no}`}>
              <TableCell className="border-r">{`${bill.serial} ${bill.loan_no}`}</TableCell>
              <TableCell className="border-r">
                {viewableDate(bill.date)}
              </TableCell>
              <TableCell
                className={cn(
                  'border-r',
                  bill.months > 18
                    ? 'bg-destructive text-white border-destructive'
                    : ''
                )}
              >
                {bill.months}
              </TableCell>
              <TableCell className="text-right border-r">
                ₹{bill.loan_amount.toFixed(2)}
              </TableCell>
              <TableCell className="text-right border-r">
                <Tooltip>
                  <TooltipTrigger>₹{bill.interest.toFixed(2)}</TooltipTrigger>
                  <TooltipContent side="right" className="px-2 py-1 text-xs">
                    {bill.interest === 0
                      ? `₹${(
                          bill.interest +
                          bill.firstMonthInterest +
                          bill.docCharges
                        ).toFixed(2)}`
                      : `₹${bill.interest.toFixed(2)} + ₹
                    ${(bill.firstMonthInterest + bill.docCharges).toFixed(2)} = ₹
                    ${(
                      bill.interest +
                      bill.firstMonthInterest +
                      bill.docCharges
                    ).toFixed(2)}`}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="text-right border-r">
                ₹{(bill.interest + bill.loan_amount).toFixed(2)}
              </TableCell>
              <TableCell className="border-r">{bill.description}</TableCell>
              <TableCell className="text-right border-r">
                {bill.weight.toFixed(2)} gms
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell className="text-right border-l">
              ₹{totals.principle.toFixed(2)}
            </TableCell>
            <TableCell className="text-right border-x">
              ₹{totals.interest.toFixed(2)}
            </TableCell>
            <TableCell className="text-right border-r">
              ₹{totals.total.toFixed(2)}
            </TableCell>
            <TableCell />
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
