import { useCompany } from '@/context/CompanyProvider.tsx';
import { useEffect, useState } from 'react';
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
import { errorToast, formatCurrency, viewableDate } from '@/lib/myUtils.tsx';
import GoHome from '@/components/GoHome.tsx';

export default function ReleaseInterest() {
  const { company } = useCompany();
  const [date, setDate] = useState(company?.current_date);
  const [bills, setBills] = useState<Record<string, Tables['releases'][]>>({});

  useEffect(() => {
    setDate(company?.current_date);
  }, [company?.current_date]);

  useEffect(() => {
    const run = async () => {
      try {
        const releasesResponse = await read('releases', { date });

        const aggregatedBills = (releasesResponse ?? []).reduce<
          Record<string, Tables['releases'][]>
        >((acc, release) => {
          if (!acc[release.company]) {
            acc[release.company] = [];
          }
          acc[release.company].push(release);
          return acc;
        }, {});

        setBills(aggregatedBills);
      } catch (e) {
        errorToast(e);
      }
    };

    void run();
  }, [date]);

  return (
    <div className="p-3 w-4/10 mx-auto">
      <div className="flex justify-between mb-4">
        <GoHome />
        <DatePicker
          className="w-27.5"
          value={date}
          onInputChange={setDate}
          navigated
          showDay
        />
        <div className="text-xl"></div>
      </div>
      {Object.entries(bills)
        .sort((c1) => {
          if (c1[0] === 'Sri Mahaveer Bankers') return -1;
          return 0;
        })
        .map(([name, value]) => {
          return (
            <div key={name}>
              <div className="mt-3 mb-2 text-center">{name}</div>
              <div className="flex gap-3">
                <Table className="table-auto">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="border-r">Loan No</TableHead>
                      <TableHead className="border-r text-right">
                        Loan Date
                      </TableHead>
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
                    {value.map((release) => (
                      <TableRow key={`${release.serial}-${release.loan_no}`}>
                        <TableCell className="border-r">{`${release.serial} ${release.loan_no}`}</TableCell>
                        <TableCell className="border-r text-right">
                          {viewableDate(release.loan_date)}
                        </TableCell>
                        <TableCell className="border-r text-right">
                          {formatCurrency(release.loan_amount, true)}
                        </TableCell>
                        <TableCell className="border-r text-right">
                          {formatCurrency(release.tax_interest_amount, true)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(release.total_amount, true)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })}
    </div>
  );
}
