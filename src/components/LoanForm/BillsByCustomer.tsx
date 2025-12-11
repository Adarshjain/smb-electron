import { useEffect, useState } from 'react';
import { fetchBillsByCustomer } from '@/lib/myUtils.tsx';
import type { Tables } from '@/../tables';
import BillAsLineItem from '@/components/LoanForm/BillAsLineItem.tsx';
import CustomerInfo from '@/components/LoanForm/CustomerInfo.tsx';

export default function BillsByCustomer(props: {
  customerId: string;
  showCustomerInfo?: boolean;
  skipReleased?: boolean;
  currentBillNumber?: [string, number];
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
        <>
          <CustomerInfo
            customer={bills[0].full_customer.customer}
            area={bills[0].full_customer.area}
          />
          <BillAsLineItem
            bills={bills}
            currentBillNumber={props.currentBillNumber}
          />
        </>
      ) : null}
    </div>
  );
}
