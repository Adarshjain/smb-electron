import { memo, useEffect, useState } from 'react';
import CustomerPicker from '@/components/CustomerPicker';
import type { Tables } from '../../../tables';
import { read } from '@/hooks/dbUtil.ts';
import { toastElectronResponse } from '@/lib/myUtils.tsx';
import { toast } from 'sonner';

interface LoanCustomerSectionProps {
  selectedCustomer: Tables['customers']['Row'] | null;
  onCustomerSelect: (customer: Tables['customers']['Row']) => void;
}

export const LoanCustomerSection = memo(function LoanCustomerSection({
  selectedCustomer,
  onCustomerSelect,
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
      if (response.success) {
        if (response.data?.length) {
          setSelectedArea(response.data[0]);
        } else {
          toast.error('Area not Found!');
        }
      } else {
        toastElectronResponse(response);
      }
    };
    void run();
  }, [selectedCustomer]);
  return (
    <div>
      <CustomerPicker onSelect={onCustomerSelect} />
      <div className="pl-3 py-2 min-h-[136px]">
        {selectedCustomer && (
          <>
            <div>
              {selectedCustomer.name} {selectedCustomer.fhtitle}{' '}
              {selectedCustomer.fhname}
            </div>
            {selectedCustomer.address1 && selectedCustomer.address1 !== '.' && (
              <div>
                {selectedCustomer.door_no} {selectedCustomer.address1},
              </div>
            )}
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
          </>
        )}
      </div>
    </div>
  );
});
