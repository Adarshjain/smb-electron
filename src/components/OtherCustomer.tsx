import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { query, read } from '@/hooks/dbUtil.ts';
import type { LocalTables } from '../../tables';
import {
  errorToast,
  formatCurrency,
  successToast,
  viewableDate,
} from '@/lib/myUtils.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.tsx';
import { useCompany } from '@/context/CompanyProvider.tsx';
import GoHome from '@/components/GoHome.tsx';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import ModifyLoanCustomer from '@/components/ModifyLoanCustomer.tsx';
import { SerialNumber } from '@/components/LoanForm/SerialNumber.tsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEnterNavigation } from '@/hooks/useEnterNavigation.ts';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const SerialSchema = z.object({
  serial: z.string().length(1),
<<<<<<< HEAD
  loan_no: z.number(),
=======
  loan_no: z.string(),
>>>>>>> ac0b3504712b02c28a5cb5bc14acc55fa1bde170
});
type ISerial = z.infer<typeof SerialSchema>;

export default function OtherCustomer() {
  const { company } = useCompany();
  const [bills, setBills] = useState<LocalTables<'bills'>[]>([]);
  const [customers, setCustomers] = useState<
    Record<string, LocalTables<'customers'>>
  >({});
  const perPage = 25;
  const [loansCount, setLoansCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentLoan, setCurrentLoan] = useState<LocalTables<'bills'> | null>(
    null
  );
  const [activeOnly, setActiveOnly] = useState(true);

  const defaultValues: ISerial = {
    serial: '',
<<<<<<< HEAD
    loan_no: 0,
=======
    loan_no: '',
>>>>>>> ac0b3504712b02c28a5cb5bc14acc55fa1bde170
  };

  const { control, getValues } = useForm<ISerial>({
    resolver: zodResolver(SerialSchema),
    defaultValues,
  });

  const { setFormRef } = useEnterNavigation({
    fields: ['serial', 'loan_no'],
  });

  const fetchSerials = useCallback(async () => {
    try {
      const loansQuery = query<LocalTables<'bills'>[]>(
        `SELECT b.*
         FROM bills b
                JOIN (SELECT DISTINCT serial, loan_no
                      FROM bill_items
                      WHERE deleted IS NULL
                        AND (quality LIKE '%@%' OR quality LIKE '%#%')) bi
                     ON b.serial = bi.serial
                       AND b.loan_no = bi.loan_no
         WHERE b.deleted IS NULL
           AND b.company = ?
           AND (b.released = 0 OR b.released = ?)
         ORDER BY b.serial, b.loan_no
         LIMIT ? OFFSET ?`,
        [company?.name, activeOnly ? 0 : 1, perPage, currentPage * perPage]
      );
      const loansCountQuery = query<[{ total: number }]>(
        `SELECT COUNT(*) AS total
         FROM bills b
                JOIN (
           SELECT DISTINCT serial, loan_no
           FROM bill_items
           WHERE deleted IS NULL
             AND (quality LIKE '%@%' OR quality LIKE '%#%')
         ) bi
                     ON b.serial = bi.serial
                       AND b.loan_no = bi.loan_no
         WHERE b.deleted IS NULL
           AND b.company = ?
           AND (b.released = 0 OR b.released = ?)`,
        [company?.name, activeOnly ? 0 : 1]
      );
      const [loans, loansCountResp] = await Promise.all([
        loansQuery,
        loansCountQuery,
      ]);
      const customerIds = [...new Set(loans?.map((l) => l.customer_id))];
      const customers = await query<LocalTables<'customers'>[]>(
        `SELECT * from customers where id IN ('${customerIds.join("','")}')`
      );
      const map: Record<string, LocalTables<'customers'>> = {};
      customers?.forEach((customer) => (map[customer.id] = customer));
      setLoansCount(loansCountResp?.[0].total ?? 0);
      setBills(loans ?? []);
      setCustomers(map);
    } catch (error) {
      errorToast(error);
    }
  }, [activeOnly, company?.name, currentPage]);

  const updateCustomerForBill = async (customerId: string) => {
    try {
      await query<null>(
        `UPDATE bills
                       SET customer_id = ?,
                           synced      = 0
                       WHERE serial = ?
                         AND loan_no = ?`,
        [customerId, currentLoan?.serial, currentLoan?.loan_no],
        true
      );
      await query<null>(
        `UPDATE bill_items
         SET quality = TRIM(REPLACE(REPLACE(quality, '@', ''), '#', '')),
             synced  = 0
         WHERE serial = ?
           AND loan_no = ?
           AND (quality LIKE '%@%' OR quality LIKE '%#%')`,
        [currentLoan?.serial, currentLoan?.loan_no],
        true
      );
      setCurrentLoan(null);
      successToast('Updated!');
    } catch (e) {
      errorToast(e);
    }
  };

  async function onLoanNumberInput(e?: ReactKeyboardEvent<HTMLInputElement>) {
    if (e) e.preventDefault();
    const { serial, loan_no } = getValues();
    if (!serial || !loan_no) return;
    try {
      const bill = await read('bills', {
        serial: serial.toUpperCase(),
<<<<<<< HEAD
        loan_no,
=======
        loan_no: parseInt(loan_no),
>>>>>>> ac0b3504712b02c28a5cb5bc14acc55fa1bde170
      });
      if (bill?.length) {
        await loadCustomer(bill[0].customer_id);
        setCurrentLoan(bill[0]);
      } else {
        errorToast('No bills matched.');
      }
    } catch (error) {
      errorToast(error);
    }
  }

  const loadCustomer = async (customerId: string) => {
    if (customers[customerId]) {
      return;
    }
    const fetchedCustomers = await read('customers', { id: customerId });
    if (fetchedCustomers?.length) {
      setCustomers((oldCustomers) => ({
        ...oldCustomers,
        [customerId]: fetchedCustomers[0],
      }));
    }
  };

  useEffect(() => {
    void fetchSerials();
  }, [fetchSerials]);

  return (
    <div className="p-2 w-7/10 mx-auto">
      <div className="flex gap-4 items-center mb-2" ref={setFormRef}>
        <GoHome />
        <div className="text-xl">Other Customers</div>
        <SerialNumber
          control={control}
          serialFieldName="serial"
          numberFieldName="loan_no"
          onNumFieldKeyDown={(e) => void onLoanNumberInput(e)}
          autoFocus
        />
        <div className="flex gap-1 items-center">
          <Checkbox
            id="use_date_picker"
            checked={activeOnly}
            onCheckedChange={(e) => setActiveOnly(!!e)}
          />
          <Label htmlFor="use_date_picker">Active Only</Label>
        </div>
        <div className="flex ml-auto items-center gap-2">
          <Button
            variant="outline"
            className="border-input h-7"
            disabled={currentPage === 0}
            onClick={() => setCurrentPage((oldCount) => oldCount - 1)}
          >
            <ArrowLeft />
            Prev
          </Button>
          <div className="text-sm text-gray-600">
            {currentPage * perPage + 1} - {(currentPage + 1) * perPage} of{' '}
            {loansCount} customers
          </div>
          <Button
            variant="outline"
            className="border-input h-7"
            disabled={currentPage === Math.ceil(loansCount / perPage) - 1}
            onClick={() => setCurrentPage((oldCount) => oldCount + 1)}
          >
            Next
            <ArrowRight />
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="border-r">Serial</TableHead>
            <TableHead className="border-r">Date</TableHead>
            <TableHead className="border-r">Name</TableHead>
            <TableHead className="border-r">FHName</TableHead>
            <TableHead className="text-right border-r">Amount</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((bill) => {
            const customer = customers[bill.customer_id];
            return (
              <TableRow key={`${bill.serial}-${bill.loan_no}`}>
                <TableCell className="border-r py-1">{`${bill.serial} ${bill.loan_no}`}</TableCell>
                <TableCell className="border-r py-0">
                  {viewableDate(bill.date)}
                </TableCell>
                <TableCell className="border-r py-0">{customer.name}</TableCell>
                <TableCell className="border-r py-0">
                  <span className="w-8 border-r inline-block">
                    {customer.fhtitle}
                  </span>{' '}
                  {customer.fhname}
                </TableCell>
                <TableCell className="text-right border-r py-0">
                  {formatCurrency(bill.loan_amount)}
                </TableCell>
                <TableCell className="py-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6"
                    onClick={() => {
                      setCurrentLoan(bill);
                    }}
                  >
                    Modify
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ModifyLoanCustomer
        bill={currentLoan}
        existingCustomer={customers[currentLoan?.customer_id ?? ''] ?? null}
        onClose={() => {
          setCurrentLoan(null);
        }}
        onSave={(customerId: string) => {
          void updateCustomerForBill(customerId);
        }}
      />
    </div>
  );
}
