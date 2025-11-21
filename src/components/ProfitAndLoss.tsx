import FYPicker from '@/components/FYPicker.tsx';
import { useEffect, useState } from 'react';
import { query } from '@/hooks/dbUtil.ts';
import { useCompany } from '@/context/CompanyProvider.tsx';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { errorToast, formatCurrency } from '@/lib/myUtils.tsx';
import { cn } from '@/lib/utils.ts';
import { SearchIcon } from 'lucide-react';

export default function ProfitAndLoss() {
  const { company } = useCompany();
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [displayExpenseRows, setDisplayExpenseRows] = useState<
    [string, string, string][]
  >([]);
  const [displayIncomeRows, setDisplayIncomeRows] = useState<
    [string, string, string][]
  >([]);

  useEffect(() => {
    if (!startDate || !endDate || !company) return;
    const fetchDetails = async () => {
      try {
        const entries = await query<
          {
            code: number;
            name: string;
            hisaabGroup: string;
            net: number;
          }[]
        >(`SELECT ah.code,
                  ah.name,
                  ah.hisaabGroup,
                  ABS(SUM(de.credit) - SUM(de.debit)) AS net
           FROM account_head AS ah
                  LEFT JOIN daily_entries AS de
                            ON ah.code = de.main_code
                              AND de.company = '${company.name}'
                              AND de.date >= '${startDate}'
                              AND de.date <= '${endDate}'
           WHERE ah.company = '${company.name}'
             AND ah.hisaabGroup IN ('Income', 'Expenses')
           GROUP BY ah.code, ah.name, ah.hisaabGroup
           HAVING SUM(de.debit) IS NOT NULL
               OR SUM(de.credit) IS NOT NULL
           ORDER BY ah.name;
        `);
        const incomeRows: [string, string, string][] = [];
        const expenseRows: [string, string, string][] = [];
        let incomeTotal = 0;
        let expenseTotal = 0;
        entries?.forEach((entry) => {
          if (entry.hisaabGroup === 'Income') {
            incomeTotal += entry.net;
            incomeRows.push([entry.name, formatCurrency(entry.net, true), '']);
          } else {
            expenseTotal += entry.net;
            expenseRows.push([entry.name, formatCurrency(entry.net, true), '']);
          }
        });
        expenseRows.unshift([
          'Expenses',
          '',
          formatCurrency(expenseTotal, true),
        ]);
        incomeRows.unshift(['Income', '', formatCurrency(incomeTotal, true)]);

        expenseRows.push([
          'NETT PROFIT',
          '',
          formatCurrency(incomeTotal - expenseTotal, true),
        ]);

        expenseRows.push(['', '', '']);
        expenseRows.push(['Total', '', formatCurrency(incomeTotal, true)]);

        while (incomeRows.length < expenseRows.length) {
          incomeRows.push(['', '', '']);
        }
        incomeRows.pop();
        incomeRows.push(['Total', '', formatCurrency(incomeTotal, true)]);

        setDisplayIncomeRows(incomeRows);
        setDisplayExpenseRows(expenseRows);
      } catch (error) {
        errorToast(error);
      }
    };
    void fetchDetails();
  });

  return (
    <div className="p-4">
      <div className="place-items-center">
        <FYPicker
          onChange={([start, end]) => {
            setStartDate(start);
            setEndDate(end);
          }}
        />
      </div>
      <div className="flex gap-4 mt-4">
        {[displayExpenseRows, displayIncomeRows].map((type, typeIndex) => (
          <Table key={typeIndex}>
            <TableBody>
              {type.map((row, outerIndex) => (
                <TableRow
                  key={JSON.stringify(row) + outerIndex}
                  className="group"
                >
                  {row.map((cell, index) => (
                    <TableCell
                      key={JSON.stringify(cell) + index}
                      className={cn(
                        'py-1.5 h-[33px]',
                        index !== 0 ? 'text-right border-l' : ''
                      )}
                    >
                      <div className="flex justify-between">
                        {index === 1 && (
                          <SearchIcon
                            size={18}
                            className="opacity-0 group-hover:opacity-100 cursor-pointer"
                          />
                        )}
                        <div className="flex-1">{cell}</div>
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}
      </div>
    </div>
  );
}
