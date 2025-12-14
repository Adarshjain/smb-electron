import { memo, useEffect, useRef, useState } from 'react';
import { fetchBillsByCustomer } from '@/lib/myUtils.tsx';
import type { Tables } from '@/../tables';
import BillAsLineItem from '@/components/LoanForm/BillAsLineItem.tsx';
import CustomerInfo from '@/components/LoanForm/CustomerInfo.tsx';

interface BillsByCustomerProps {
  customerId: string;
  showCustomerInfo?: boolean;
  skipReleased?: boolean;
  currentBillNumber?: [string, number];
}

export default memo(function BillsByCustomer({
  customerId,
  showCustomerInfo = false,
  skipReleased = true,
  currentBillNumber,
}: BillsByCustomerProps) {
  const [bills, setBills] = useState<Tables['full_bill'][]>([]);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;

    const run = async () => {
      const result = await fetchBillsByCustomer(customerId, skipReleased);
      if (!abortRef.current) {
        setBills(result ?? []);
      }
    };
    void run();

    return () => {
      abortRef.current = true;
    };
  }, [customerId, skipReleased]);

  if (!showCustomerInfo) {
    return <BillAsLineItem bills={bills} />;
  }

  return (
    <div className="flex gap-3 flex-col">
      <CustomerInfo
        customer={bills[0].full_customer.customer}
        area={bills[0].full_customer.area}
      />
      <BillAsLineItem bills={bills} currentBillNumber={currentBillNumber} />
    </div>
  );
});
