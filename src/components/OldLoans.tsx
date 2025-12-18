import GoHome from '@/components/GoHome.tsx';
import { Input } from '@/components/ui/input.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { useCallback, useEffect, useState } from 'react';
import { query } from '@/hooks/dbUtil.ts';
import type { LocalTables, Tables } from '@/../tables';
import { errorToast } from '@/lib/myUtils.tsx';
import BillAsLineItem from '@/components/LoanForm/BillAsLineItem.tsx';
import { useDebounce } from '@/hooks/useDebounce.ts';
import { Loader } from 'lucide-react';

export default function OldLoans() {
  const [months, setMonths] = useState<string>('18');
  const [minAmountInput, setMinAmountInput] = useState(5000);
  const [maxAmountInput, setMaxAmountInput] = useState(500000);
  const [minAmount, setMinAmount] = useState(0);
  const [maxAmount, setMaxAmount] = useState(500000);
  const [renderItems, setRenderItems] = useState<Tables['full_bill'][]>([]);
  const [sort, setSort] = useState('date asc');
  const [loading, setLoading] = useState(true);

  const debouncedSetMinAmount = useDebounce((value: number) => {
    setMinAmount(value);
  }, 500);

  const debouncedSetMaxAmount = useDebounce((value: number) => {
    setMaxAmount(value);
  }, 500);

  const indexCustomerListById = (customers: LocalTables<'customers'>[]) => {
    const map: Record<string, LocalTables<'customers'>> = {};
    customers.forEach((customer) => {
      map[customer.id] = customer;
    });
    return map;
  };

  const indexBillsItemsBySerialNumber = (
    billItems: LocalTables<'bill_items'>[]
  ) => {
    const map: Record<string, LocalTables<'bill_items'>[]> = {};
    billItems.forEach((billItem) => {
      const key = `${billItem.serial}-${billItem.loan_no}`;
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(billItem);
    });
    return map;
  };

  const indexCustomerBillCountByCustomerId = (
    customerBillCount: { customer_id: string; count: number }[]
  ): Record<string, number> => {
    const map: Record<string, number> = {};
    customerBillCount.forEach((customer) => {
      map[customer.customer_id] = customer.count;
    });
    return map;
  };

  const fetchData = useCallback(async () => {
    try {
      const oldBillsQuery = query<LocalTables<'bills'>[]>(
        `select *
       from bills
       where loan_amount > ?
         and loan_amount < ?
         and released = 0
         and date < date('now', '-${parseInt(months) - 1} months')
         and deleted is null
         order by ${sort};`,
        [minAmount, maxAmount]
      );
      const customerListQuery = query<LocalTables<'customers'>[]>(
        `select *
         from customers
         where id in (select customer_id
                      from bills
                      where loan_amount > ?
                        and loan_amount < ?
                        and released = 0
                        and date < date('now', '-${parseInt(months) - 1} months')
                        and deleted is null) AND deleted IS NULL`,
        [minAmount, maxAmount]
      );

      const billItemsQuery = query<LocalTables<'bill_items'>[]>(
        `SELECT bi.*
         FROM bill_items bi
                JOIN bills b
                     ON bi.serial = b.serial
                       AND bi.loan_no = b.loan_no
         WHERE b.loan_amount > ?
           AND b.loan_amount < ?
           AND b.released = 0
           AND b.deleted IS NULL
         ORDER BY b.${sort}`,
        [minAmount, maxAmount]
      );

      const customerBillCountQuery = query<
        { customer_id: string; count: number }[]
      >(
        `select customer_id, count(serial) as count
         from bills
         where loan_amount > ?
           and loan_amount < ?
           and released = 0
           and deleted is null
           and date < date('now', '-${parseInt(months) - 1} months')
         group by customer_id`,
        [minAmount, maxAmount]
      );
      setLoading(true);
      const [oldBills, customerList, billItems, customerBillCount] =
        await Promise.all([
          oldBillsQuery,
          customerListQuery,
          billItemsQuery,
          customerBillCountQuery,
        ]);
      if (!customerList || !billItems || !customerBillCount) {
        return;
      }
      const customerIdVsCustomer = indexCustomerListById(customerList);
      const billsItemsBySerialNumber = indexBillsItemsBySerialNumber(billItems);
      const customerBillCountByCustomerId =
        indexCustomerBillCountByCustomerId(customerBillCount);
      const customerVsBills: Record<
        string,
        {
          customer: LocalTables<'customers'>;
          bills: Tables['full_bill'][];
        }
      > = {};
      oldBills?.forEach((bill) => {
        if (!customerVsBills[bill.customer_id]) {
          customerVsBills[bill.customer_id] = {
            customer: customerIdVsCustomer[bill.customer_id],
            bills: [],
          };
        }
        const key = `${bill.serial}-${bill.loan_no}`;
        customerVsBills[bill.customer_id].bills.push({
          ...bill,
          bill_items: billsItemsBySerialNumber[key],
          full_customer: { customer: customerIdVsCustomer[bill.customer_id] },
          billCount: customerBillCountByCustomerId[bill.customer_id],
        });
      });
      setRenderItems(
        Object.values(customerVsBills)
          .map((b) => b.bills)
          .flat()
      );
    } catch (e) {
      errorToast(e);
    } finally {
      setLoading(false);
    }
  }, [maxAmount, minAmount, months, sort]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) return <Loader />;

  return (
    <div className="p-4">
      <div className="flex items-center gap-4 mb-2">
        <GoHome />
        <div className="text-xl">Old Loans</div>
        <div className="flex w-50">
          <Input
            className="rounded-r-none border-r-0 text-right"
            value={minAmountInput}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            onInput={(e) => {
              const value = parseInt(e.currentTarget.value) || 0;
              setMinAmountInput(value);
              debouncedSetMinAmount(value);
            }}
          />
          <Input
            className="rounded-l-none text-right"
            value={maxAmountInput}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            onInput={(e) => {
              const value = parseInt(e.currentTarget.value) || 0;
              setMaxAmountInput(value);
              debouncedSetMaxAmount(value);
            }}
          />
        </div>
        <Select onValueChange={setMonths} value={months}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-600 text-white">
            {['12', '18', '24', '30', '36'].map((month) => (
              <SelectItem key={month} value={month}>
                {month} Months
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        Total: {renderItems.length}
      </div>
      {loading ? (
        <Loader />
      ) : (
        <BillAsLineItem
          showCustomerInfo
          bills={renderItems}
          sort={sort}
          onSortChange={setSort}
          enabledSort
        />
      )}
    </div>
  );
}
