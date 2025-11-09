import {
  formatCurrency,
  getInterest,
  getMonthDiff,
  mergeBillItems,
  viewableDate,
} from '@/lib/myUtils.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils.ts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.tsx';
import { useEffect, useState } from 'react';
import type { Tables } from '@/../tables';
import { useLoanCalculations } from '@/hooks/useLoanCalculations.ts';

type EnrichedBill = Tables['full_bill']['Row'] & {
  months: number;
  interest: number;
  firstMonthInterest: number;
  docCharges: number;
  description: string;
  weight: number;
};

export default function BillAsLineItem({
  bills,
}: {
  bills: Tables['full_bill']['Row'][];
}) {
  const [enrichedBills, setEnrichedBills] = useState<EnrichedBill[]>([]);
  const [enrichedBillsReleased, setEnrichedBillsReleased] = useState<
    EnrichedBill[]
  >([]);
  const [totals, setTotals] = useState({
    principle: 0,
    total: 0,
    interest: 0,
  });
  const [totalsReleased, setTotalsReleased] = useState({
    principle: 0,
    total: 0,
    interest: 0,
  });
  const { calculateLoanAmounts } = useLoanCalculations();

  useEffect(() => {
    setTotals({
      principle: 0,
      total: 0,
      interest: 0,
    });
    setTotalsReleased({
      principle: 0,
      total: 0,
      interest: 0,
    });
  }, [bills]);

  useEffect(() => {
    const run = async () => {
      // Precompute all async values before rendering
      const processed = await Promise.all(
        bills.map(async (bill) => {
          const months = getMonthDiff(bill.date, bill.releasedEntry?.date);
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

          if (bill.releasedEntry?.date !== undefined) {
            setTotalsReleased((tempTotal) => ({
              principle: tempTotal.principle + bill.loan_amount,
              interest: tempTotal.interest + interest,
              total: tempTotal.total + interest + bill.loan_amount,
            }));
          } else {
            setTotals((tempTotal) => ({
              principle: tempTotal.principle + bill.loan_amount,
              interest: tempTotal.interest + interest,
              total: tempTotal.total + interest + bill.loan_amount,
            }));
          }

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

      const unReleased: EnrichedBill[] = [];
      const released: EnrichedBill[] = [];
      processed.forEach((bill) => {
        if (bill.releasedEntry?.date !== undefined) {
          released.push(bill);
        } else {
          unReleased.push(bill);
        }
      });

      setEnrichedBills(unReleased);
      setEnrichedBillsReleased(released);
    };

    void run();
  }, [bills, calculateLoanAmounts]);

  if (!enrichedBills.length && !enrichedBillsReleased.length)
    return <div>No Loans</div>;

  return (
    <>
      {enrichedBills.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="border-r">Loan No</TableHead>
              <TableHead className="border-r">Date</TableHead>
              <TableHead className="border-r">Months</TableHead>
              <TableHead className="border-r">Items</TableHead>
              <TableHead className="text-right border-r">Weight</TableHead>
              <TableHead className="text-right border-r">Amount</TableHead>
              <TableHead className="text-right border-r">Interest</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrichedBills.map((bill) => {
              const total =
                bill.interest + bill.firstMonthInterest + bill.docCharges;
              return (
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

                  <TableCell className="border-r">{bill.description}</TableCell>
                  <TableCell className="text-right border-r">
                    {bill.weight.toFixed(2)} gms
                  </TableCell>
                  <TableCell className="text-right border-r">
                    {formatCurrency(bill.loan_amount)}
                  </TableCell>
                  <TableCell className="text-right border-r">
                    <Tooltip>
                      <TooltipTrigger>
                        {formatCurrency(bill.interest)}
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="px-2 py-1 text-xs"
                      >
                        {bill.interest === 0
                          ? formatCurrency(total)
                          : `${formatCurrency(bill.interest)} + ${formatCurrency(bill.firstMonthInterest + bill.docCharges)} = ${formatCurrency(total)}`}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(bill.interest + bill.loan_amount)}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell colSpan={5} />
              <TableCell className="text-right border-l">
                {formatCurrency(totals.principle)}
              </TableCell>
              <TableCell className="text-right border-x">
                {formatCurrency(totals.interest)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(totals.total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      ) : (
        <div className="w-[fit-content] px-2 py-1 rounded bg-green-200">
          No Active Loans!
        </div>
      )}
      {enrichedBillsReleased.length ? (
        <>
          <div>Released</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="border-r">Loan No</TableHead>
                <TableHead className="border-r">Date</TableHead>
                <TableHead className="border-r">Release Date</TableHead>
                <TableHead className="border-r">Months</TableHead>
                <TableHead className="border-r">Items</TableHead>
                <TableHead className="text-right border-r">Weight</TableHead>
                <TableHead className="text-right border-r">Amount</TableHead>
                <TableHead className="text-right border-r">Interest</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrichedBillsReleased.map((bill) => {
                const total =
                  bill.interest + bill.firstMonthInterest + bill.docCharges;
                return (
                  <TableRow key={`${bill.serial}-${bill.loan_no}`}>
                    <TableCell className="border-r">{`${bill.serial} ${bill.loan_no}`}</TableCell>
                    <TableCell className="border-r">
                      {viewableDate(bill.date)}
                    </TableCell>
                    <TableCell className="border-r">
                      {viewableDate(bill.releasedEntry?.date)}
                    </TableCell>
                    <TableCell className="border-r">{bill.months}</TableCell>
                    <TableCell className="border-r">
                      {bill.description}
                    </TableCell>
                    <TableCell className="text-right border-r">
                      {bill.weight.toFixed(2)} gms
                    </TableCell>
                    <TableCell className="text-right border-r">
                      {formatCurrency(bill.loan_amount)}
                    </TableCell>
                    <TableCell className="text-right border-r">
                      <Tooltip>
                        <TooltipTrigger>
                          {formatCurrency(bill.interest)}
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          className="px-2 py-1 text-xs"
                        >
                          {bill.interest === 0
                            ? formatCurrency(total)
                            : `${formatCurrency(bill.interest)} + ${formatCurrency(bill.firstMonthInterest + bill.docCharges)} = ${formatCurrency(total)}`}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(bill.interest + bill.loan_amount)}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={6} />
                <TableCell className="text-right border-l">
                  {formatCurrency(totalsReleased.principle)}
                </TableCell>
                <TableCell className="text-right border-l">
                  {formatCurrency(totalsReleased.interest)}
                </TableCell>
                <TableCell className="text-right border-l">
                  {formatCurrency(totalsReleased.total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </>
      ) : null}
    </>
  );
}
