import { useEffect, useState } from 'react';
import { fetchBillsByCustomer } from '@/lib/myUtils.tsx';
import type { LocalTables, Tables } from '@/../tables';
import BillAsLineItem from '@/components/LoanForm/BillAsLineItem.tsx';
import CustomerInfo from '@/components/LoanForm/CustomerInfo.tsx';

export default function BillsByCustomer(props: {
  customerId: string;
  showCustomerInfo?: boolean;
  skipReleased?: boolean;
}) {
  const [bills, setBills] = useState<Tables['full_bill'][]>([]);
  useEffect(() => {
    const run = async () => {
      setBills(
        (await fetchBillsByCustomer(props.customerId, props.skipReleased)) ?? []
      );
    };
    void run();
  }, [props.customerId, props.skipReleased]);

  if (!props.showCustomerInfo) {
    return <BillAsLineItem bills={bills} />;
  }
  return (
    <div className="flex gap-3 flex-col">
      {bills.length ? (
        <CustomerInfo
          customer={bills[0].full_customer.customer as LocalTables<'customers'>}
          area={bills[0].full_customer.area}
        />
      ) : null}
      <BillAsLineItem bills={bills} />
    </div>
  );
}
