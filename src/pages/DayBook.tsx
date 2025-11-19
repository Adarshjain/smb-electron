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
import { errorToast, formatCurrency } from '@/lib/myUtils.tsx';
import GoHome from '@/components/GoHome.tsx';

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

export default function DayBook() {
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
      try {
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
        billsResponse?.forEach((bill) => {
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

        releasesResponse?.forEach((release) => {
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

        setBills(aggregatedBills);
      } catch (e) {
        errorToast(e);
      }
    };
    void run();
  }, [date]);

  return (
    <div className="p-3">
      <div className="flex justify-between mb-4">
        <GoHome />
        <div className="text-xl">Loans</div>
        <DatePicker
          className="w-27.5"
          value={date}
          onInputChange={setDate}
          navigated
        />
        <div className="text-xl">Releases</div>
        <div className="text-xl"></div>
      </div>
      <div className="flex justify-around"></div>
      <div className="flex justify-between gap-3">
        {/* Loan Summary */}
        <Table className="table-auto">
          <TableHeader>
            <TableRow>
              <TableHead className="border-r">Company</TableHead>
              <TableHead className="border-r text-right">Principal</TableHead>
              <TableHead className="border-r text-right">Interest</TableHead>
              <TableHead className="text-right">Count</TableHead>
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
                    <TableCell className="border-r text-right">
                      {formatCurrency(value.loan.principalTotal, true)}
                    </TableCell>
                    <TableCell className="border-r text-right">
                      {formatCurrency(value.loan.interestTotal, true)}
                    </TableCell>
                    <TableCell className="text-right">
                      {value.loans.length}
                    </TableCell>
                  </TableRow>
                );
              })}
            <TableRow>
              <TableCell className="border-r">Total</TableCell>
              <TableCell className="border-r text-right">
                {formatCurrency(totals.loanPrincipalTotal)}
              </TableCell>
              <TableCell className="border-r text-right">
                {formatCurrency(totals.loanInterestTotal)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        {/* Release Summary */}
        <Table className="table-auto">
          <TableHeader>
            <TableRow>
              <TableHead className="border-r">Company</TableHead>
              <TableHead className="border-r text-right">Principal</TableHead>
              <TableHead className="border-r text-right">Interest</TableHead>
              <TableHead className="text-right">Count</TableHead>
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
                    <TableCell className="border-r text-right">
                      {formatCurrency(value.release.principalTotal, true)}
                    </TableCell>
                    <TableCell className="border-r text-right">
                      {formatCurrency(value.release.interestTotal, true)}
                    </TableCell>
                    <TableCell className="text-right">
                      {value.releases.length}
                    </TableCell>
                  </TableRow>
                );
              })}
            <TableRow>
              <TableCell className="border-r">Total</TableCell>
              <TableCell className="border-r text-right">
                {formatCurrency(totals.releasePrincipalTotal)}
              </TableCell>
              <TableCell className="border-r text-right">
                {formatCurrency(totals.releaseInterestTotal)}
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="border-r">Loan No</TableHead>
                      <TableHead className="border-r text-right">
                        Principal
                      </TableHead>
                      <TableHead className="border-r text-right">
                        Interest
                      </TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {value.loans.map((loan) => (
                      <TableRow key={`${loan.serial}-${loan.loan_no}`}>
                        <TableCell className="border-r">{`${loan.serial} ${loan.loan_no}`}</TableCell>
                        <TableCell className="border-r text-right">
                          {formatCurrency(loan.loan_amount, true)}
                        </TableCell>
                        <TableCell className="border-r text-right">
                          {formatCurrency(loan.interest, true)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(loan.total, true)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="border-r">Total</TableCell>
                      <TableCell className="border-r text-right">
                        {formatCurrency(value.loan.principalTotal)}
                      </TableCell>
                      <TableCell className="border-r text-right">
                        {formatCurrency(value.loan.interestTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(value.loan.total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                {/*Release List*/}
                <Table className="table-auto">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="border-r">Loan No</TableHead>
                      <TableHead className="border-r text-right">
                        Principal
                      </TableHead>
                      <TableHead className="border-r text-right">
                        Interest
                      </TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {value.releases.map((release) => (
                      <TableRow key={`${release.serial}-${release.loan_no}`}>
                        <TableCell className="border-r">{`${release.serial} ${release.loan_no}`}</TableCell>
                        <TableCell className="border-r text-right">
                          {formatCurrency(release.loan_amount, true)}
                        </TableCell>
                        <TableCell className="border-r text-right">
                          {formatCurrency(release.interest_amount, true)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(release.total_amount, true)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="border-r">Total</TableCell>
                      <TableCell className="border-r text-right">
                        {formatCurrency(value.release.principalTotal)}
                      </TableCell>
                      <TableCell className="border-r text-right">
                        {formatCurrency(value.release.interestTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(value.release.total)}
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
