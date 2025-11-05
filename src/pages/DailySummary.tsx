import { useCompany } from '@/context/CompanyProvider.tsx';
import { useEffect, useMemo, useState } from 'react';
import { read } from '@/hooks/dbUtil.ts';
import type { Tables } from '../../tables';
import DatePicker from '@/components/DatePicker.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AggregatedBills {
  loan: {
    total: number;
    principalTotal: number;
    interestTotal: number;
  };
  release: {
    total: number;
    principalTotal: number;
    interestTotal: number;
  };
  loans: (Tables['bills']['Row'] & { interest: number; total: number })[];
  releases: Tables['releases']['Row'][];
}

export default function DailySummary() {
  const { company } = useCompany();
  const [date, setDate] = useState(company?.current_date);
  const [bills, setBills] = useState<Record<string, AggregatedBills>>({});

  const totals = useMemo(() => {
    return Object.values(bills).reduce(
      (total, current) => {
        total.loanPrincipalTotal += current.loan.principalTotal;
        total.loanInterestTotal += current.loan.interestTotal;
        total.releaseInterestTotal += current.release.interestTotal;
        total.releasePrincipalTotal += current.release.principalTotal;
        return total;
      },
      {
        loanPrincipalTotal: 0,
        loanInterestTotal: 0,
        releasePrincipalTotal: 0,
        releaseInterestTotal: 0,
      }
    );
  }, [bills]);

  useEffect(() => {
    setDate(company?.current_date);
  }, [company?.current_date]);

  useEffect(() => {
    const run = async () => {
      const billsPromise = read('bills', {
        date,
      });
      const releasesPromise = read('releases', {
        date,
      });
      const [billsResponse, releasesResponse] = await Promise.all([
        billsPromise,
        releasesPromise,
      ]);
      const aggregatedBills: Record<string, AggregatedBills> = {};
      if (billsResponse.success) {
        billsResponse.data?.forEach((bill) => {
          if (!aggregatedBills[bill.company]) {
            aggregatedBills[bill.company] = {
              loan: {
                total: 0,
                interestTotal: 0,
                principalTotal: 0,
              },
              release: {
                total: 0,
                interestTotal: 0,
                principalTotal: 0,
              },
              loans: [],
              releases: [],
            };
          }
          const interestTotal = bill.first_month_interest + bill.doc_charges;
          aggregatedBills[bill.company].loan.principalTotal += bill.loan_amount;
          aggregatedBills[bill.company].loan.interestTotal += interestTotal;
          aggregatedBills[bill.company].loan.total +=
            bill.loan_amount + interestTotal;

          aggregatedBills[bill.company].loans.push({
            ...bill,
            interest: interestTotal,
            total: bill.loan_amount + interestTotal,
          });
        });
      }

      if (releasesResponse.success) {
        releasesResponse.data?.forEach((release) => {
          if (!aggregatedBills[release.company]) {
            aggregatedBills[release.company] = {
              loan: {
                total: 0,
                interestTotal: 0,
                principalTotal: 0,
              },
              release: {
                total: 0,
                interestTotal: 0,
                principalTotal: 0,
              },
              loans: [],
              releases: [],
            };
          }
          aggregatedBills[release.company].release.principalTotal +=
            release.loan_amount;
          aggregatedBills[release.company].release.interestTotal +=
            release.interest_amount;
          aggregatedBills[release.company].release.total +=
            release.total_amount;

          aggregatedBills[release.company].releases.push(release);
        });
      }

      setBills(aggregatedBills);
    };
    void run();
  }, [date]);

  return (
    <div className="p-3">
      <div className="flex justify-around mb-4">
        <div className="text-xl">Loans</div>
        <DatePicker
          className="w-27.5"
          value={date}
          onInputChange={setDate}
          navigated
        />
        <div className="text-xl">Releases</div>
      </div>
      <div className="flex justify-around"></div>
      <div className="flex justify-between gap-3">
        {/* Loan Summary */}
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead className="border-r">Company</TableHead>
              <TableHead className="border-r text-right">Principal</TableHead>
              <TableHead className="border-r text-right">Interest</TableHead>
              <TableHead className="border-r text-right">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(bills)
              .sort((c1) => {
                if (c1[0] === 'Sri Mahaveer Bankers') return -1;
                if (c1[0] === 'Mahaveer Bankers') return -1;
                return 0;
              })
              .map(([name, value]) => {
                return (
                  <TableRow key={name}>
                    <TableCell className="border-r">{name}</TableCell>
                    <TableCell className="border-r text-right tabular-nums">
                      {value.loan.principalTotal.toFixed(2)}
                    </TableCell>
                    <TableCell className="border-r text-right tabular-nums">
                      {value.loan.interestTotal.toFixed(2)}
                    </TableCell>
                    <TableCell className="border-r text-right tabular-nums">
                      {value.loans.length}
                    </TableCell>
                  </TableRow>
                );
              })}
            <TableRow>
              <TableCell className="border-r">Total</TableCell>
              <TableCell className="border-r text-right tabular-nums">
                {totals.loanPrincipalTotal.toFixed(2)}
              </TableCell>
              <TableCell className="border-r text-right tabular-nums">
                {totals.loanInterestTotal.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        {/* Release Summary */}
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead className="border-r">Company</TableHead>
              <TableHead className="border-r text-right">Principal</TableHead>
              <TableHead className="border-r text-right">Interest</TableHead>
              <TableHead className="border-r text-right">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(bills)
              .sort((c1) => {
                if (c1[0] === 'Sri Mahaveer Bankers') return -1;
                if (c1[0] === 'Mahaveer Bankers') return -1;
                return 0;
              })
              .map(([name, value]) => {
                return (
                  <TableRow key={name}>
                    <TableCell className="border-r">{name}</TableCell>
                    <TableCell className="border-r text-right tabular-nums">
                      {value.release.principalTotal.toFixed(2)}
                    </TableCell>
                    <TableCell className="border-r text-right tabular-nums">
                      {value.release.interestTotal.toFixed(2)}
                    </TableCell>
                    <TableCell className="border-r text-right tabular-nums">
                      {value.releases.length}
                    </TableCell>
                  </TableRow>
                );
              })}
            <TableRow>
              <TableCell className="border-r">Total</TableCell>
              <TableCell className="border-r text-right tabular-nums">
                {totals.releasePrincipalTotal.toFixed(2)}
              </TableCell>
              <TableCell className="border-r text-right tabular-nums">
                {totals.releaseInterestTotal.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      {Object.entries(bills)
        .sort((c1) => {
          if (c1[0] === 'Sri Mahaveer Bankers') return -1;
          if (c1[0] === 'Mahaveer Bankers') return -1;
          return 0;
        })
        .map(([name, value]) => {
          return (
            <div key={name}>
              <div className="mt-3 mb-2 text-center">{name}</div>
              <div className="flex gap-3">
                {/*Loan List*/}
                <Table className="border">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="border-r">Loan No</TableHead>
                      <TableHead className="border-r text-right">
                        Principal
                      </TableHead>
                      <TableHead className="border-r text-right">
                        Interest
                      </TableHead>
                      <TableHead className="border-r text-right">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {value.loans.map((loan) => (
                      <TableRow key={`${loan.serial}-${loan.loan_no}`}>
                        <TableCell className="border-r">{`${loan.serial} ${loan.loan_no}`}</TableCell>
                        <TableCell className="border-r text-right tabular-nums">
                          {loan.loan_amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="border-r text-right tabular-nums">
                          {loan.interest.toFixed(2)}
                        </TableCell>
                        <TableCell className="border-r text-right tabular-nums">
                          {loan.total.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="border-r">Total</TableCell>
                      <TableCell className="border-r text-right tabular-nums">
                        ₹{value.loan.principalTotal.toFixed(2)}
                      </TableCell>
                      <TableCell className="border-r text-right tabular-nums">
                        ₹{value.loan.interestTotal.toFixed(2)}
                      </TableCell>
                      <TableCell className="border-r text-right tabular-nums">
                        ₹{value.loan.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                {/*Release List*/}
                <Table className="border">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="border-r">Loan No</TableHead>
                      <TableHead className="border-r text-right">
                        Principal
                      </TableHead>
                      <TableHead className="border-r text-right">
                        Interest
                      </TableHead>
                      <TableHead className="border-r text-right">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {value.releases.map((release) => (
                      <TableRow key={`${release.serial}-${release.loan_no}`}>
                        <TableCell className="border-r">{`${release.serial} ${release.loan_no}`}</TableCell>
                        <TableCell className="border-r text-right tabular-nums">
                          {release.loan_amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="border-r text-right tabular-nums">
                          {release.interest_amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="border-r text-right tabular-nums">
                          {release.total_amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="border-r">Total</TableCell>
                      <TableCell className="border-r text-right tabular-nums">
                        ₹{value.release.principalTotal.toFixed(2)}
                      </TableCell>
                      <TableCell className="border-r text-right tabular-nums">
                        ₹{value.release.interestTotal.toFixed(2)}
                      </TableCell>
                      <TableCell className="border-r text-right tabular-nums">
                        ₹{value.release.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })}
    </div>
  );
}
