import { memo, useEffect, useState } from 'react';
import CustomerPicker from '@/components/CustomerPicker';
import type { Tables } from '../../../tables';
import { read } from '@/hooks/dbUtil.ts';
import { toastElectronResponse } from '@/lib/myUtils.tsx';

interface LoanCustomerSectionProps {
  selectedCustomer: Tables['customers']['Row'] | null;
  onCustomerChange: (customer: Tables['customers']['Row']) => void;
}

export const LoanCustomerSection = memo(function LoanCustomerSection({
  selectedCustomer,
  onCustomerChange,
}: LoanCustomerSectionProps) {
  const [selectedArea, setSelectedArea] = useState<
    Tables['areas']['Row'] | null
  >(null);
  useEffect(() => {
    const run = async () => {
      if (!selectedCustomer) {
        return;
      }
      const response = await read('areas', {
        name: selectedCustomer.area ?? '',
      });
      if (response.success && response.data?.length) {
        setSelectedArea(response.data[0]);
      } else {
        toastElectronResponse(response);
      }
    };
    void run();
  }, [selectedCustomer]);
  return (
    <div>
      <CustomerPicker onChange={onCustomerChange} />
      {selectedCustomer && (
        <div className="pl-3 pb-6 pt-1">
          <div>
            {selectedCustomer.name} {selectedCustomer.fhtitle}{' '}
            {selectedCustomer.fhname}
          </div>
          <div>
            {selectedCustomer.door_no} {selectedCustomer.address1},
          </div>
          <div>{selectedCustomer.address2}</div>
          <div>
            {selectedCustomer.area},
            {selectedArea && (
              <div>
                {selectedArea.post ? `Post: ${selectedArea.post}` : ''}{' '}
                {selectedArea.town} {selectedArea.pincode}
              </div>
            )}
          </div>
          <div>{selectedCustomer.phone_no}</div>
        </div>
      )}
    </div>
  );
});
