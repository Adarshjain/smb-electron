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
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Tables } from '@/../tables';
import { useLoanCalculations } from '@/hooks/useLoanCalculations.ts';
import CustomerInfo from '@/components/LoanForm/CustomerInfo.tsx';
import { ArrowDownNarrowWide, ArrowDownWideNarrow } from 'lucide-react';

type EnrichedBill = Tables['full_bill'] & {
  months: number;
  interest: number;
  firstMonthInterest: number;
  docCharges: number;
  description: string;
  weight: number;
  rowSpan?: number;
};

export default function BillAsLineItem({
  bills,
  currentBillNumber,
  showCustomerInfo = false,
  sort,
  onSortChange,
  enabledSort = false,
}: {
  bills: Tables['full_bill'][];
  currentBillNumber?: [string, number];
  showCustomerInfo?: boolean;
  sort?: string;
  onSortChange?: (sort: string) => void;
  enabledSort?: boolean;
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
  const [sortColumn, ascDesc] = useMemo(() => (sort ?? '').split(' '), [sort]);

  const pullCurrentBillToTop = useCallback(
    (bills: EnrichedBill[], [serial, loanNo]: [string, number]) => {
      const moveToFront = (arr: EnrichedBill[], i: number) => [
        arr[i],
        ...arr.slice(0, i),
        ...arr.slice(i + 1),
      ];
      const matchedIndex = bills.findIndex(
        (bill) => bill.serial === serial && bill.loan_no === loanNo
      );
      if (matchedIndex !== -1) {
        bills = moveToFront(bills, matchedIndex);
      }
      return bills;
    },
    []
  );

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
      let processed: EnrichedBill[] = [];
      // Precompute all async values before rendering
      for (const bill of bills) {
        const months = getMonthDiff(bill.date, bill.releasedEntry?.date);
        const interest = getInterest(
          bill.loan_amount,
          bill.interest_rate,
          months
        );
        const { description, weight } = mergeBillItems(
          bill.bill_items,
          bill.metal_type
        );
        const { firstMonthInterest, docCharges } = (await calculateLoanAmounts(
          bill.loan_amount,
          bill.metal_type,
          {
            customInterestRate: bill.interest_rate,
          }
        )) ?? { firstMonthInterest: 0, docCharges: 0 };

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

        processed.push({
          ...bill,
          months,
          interest,
          firstMonthInterest,
          docCharges,
          description,
          weight,
          rowSpan: bill.billCount,
        });
      }
      const unReleased: EnrichedBill[] = [];
      const released: EnrichedBill[] = [];
      if (currentBillNumber) {
        processed = pullCurrentBillToTop(processed, currentBillNumber);
      }

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
  }, [bills, calculateLoanAmounts, currentBillNumber, pullCurrentBillToTop]);

  const renderBillDescription = (bill: EnrichedBill) => {
    return (
      <div className="flex items-baseline">
        <div
          className={cn(
            'p-0.5 py-0 text-xs rounded mr-1 text-white',
            bill.metal_type === 'Gold' ? 'bg-yellow-500' : 'bg-gray-400'
          )}
        >
          {bill.metal_type === 'Gold' ? 'G' : 'S'}
        </div>
        {bill.description
          .split(',')
          .map((t) => t.trim())
          .join('\n')}
      </div>
    );
  };

  const sorter = (column: string) => {
    if (!enabledSort) return null;
    return sortColumn === column ? (
      ascDesc !== 'desc' ? (
        <ArrowDownNarrowWide
          size={18}
          className="cursor-pointer"
          onClick={() => onSortChange?.(`${column} desc`)}
        />
      ) : (
        <ArrowDownWideNarrow
          size={18}
          className="cursor-pointer"
          onClick={() => onSortChange?.(`${column} asc`)}
        />
      )
    ) : (
      <ArrowDownWideNarrow
        size={18}
        className="text-muted-foreground hover:opacity-100 opacity-50 cursor-pointer"
        onClick={() => onSortChange?.(`${column} desc`)}
      />
    );
  };

  if (!enrichedBills.length && !enrichedBillsReleased.length)
    return <div>No Loans</div>;

  return (
    <>
      {enrichedBills.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              {showCustomerInfo ? (
                <TableHead className="border-r">Customer</TableHead>
              ) : null}
              <TableHead className="border-r">Loan No</TableHead>
              <TableHead className="border-r">
                <div className="flex justify-between">Date{sorter('date')}</div>
              </TableHead>
              <TableHead className="border-r">Months</TableHead>
              <TableHead className="border-r">Items</TableHead>
              <TableHead className="text-right border-r">Weight</TableHead>
              <TableHead className="text-right border-r">
                <div className="flex justify-between">
                  Amount{sorter('loan_amount')}
                </div>
              </TableHead>
              <TableHead className="text-right border-r">Interest</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrichedBills.map((bill, index) => {
              const total =
                bill.interest + bill.firstMonthInterest + bill.docCharges;
              const showCustomer =
                index === 0
                  ? true
                  : enrichedBills[index - 1].full_customer.customer.id !==
                    bill.full_customer.customer.id;
              return (
                <TableRow key={`${bill.serial}-${bill.loan_no}`}>
                  {showCustomerInfo && showCustomer ? (
                    <TableCell className="border-r" rowSpan={bill.rowSpan}>
                      <CustomerInfo
                        customer={bill.full_customer.customer}
                        skipAddress
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="border-r">{`${bill.serial} ${bill.loan_no}`}</TableCell>
                  <TableCell className="border-r">
                    {viewableDate(bill.date)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'border-r',
                      !showCustomerInfo && bill.months > 18
                        ? 'bg-destructive text-white border-destructive'
                        : ''
                    )}
                  >
                    {bill.months} + 1
                  </TableCell>

                  <TableCell className="border-r whitespace-break-spaces">
                    {renderBillDescription(bill)}
                  </TableCell>
                  <TableCell className="text-right border-r">
                    {bill.weight.toFixed(3)} gms
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
              <TableCell colSpan={showCustomerInfo ? 6 : 5} />
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
        <div className="w-[fit-content] px-2 py-1 rounded bg-green-100">
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
                    <TableCell className="border-r">
                      {bill.months} + 1
                    </TableCell>
                    <TableCell className="border-r px-1 whitespace-break-spaces">
                      {renderBillDescription(bill)}
                    </TableCell>
                    <TableCell className="text-right border-r">
                      {bill.weight.toFixed(3)} gms
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
