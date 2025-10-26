import { memo } from 'react';
import CustomerPicker from '@/components/CustomerPicker';
import type { Tables } from '../../../tables';

interface LoanCustomerSectionProps {
  selectedCustomer: Tables['customers']['Row'] | null;
  onCustomerChange: (customer: Tables['customers']['Row']) => void;
}

export const LoanCustomerSection = memo(function LoanCustomerSection({
  selectedCustomer,
  onCustomerChange,
}: LoanCustomerSectionProps) {
  return (
    <>
      <CustomerPicker onChange={onCustomerChange} />
      {selectedCustomer && (
        <div>
          {selectedCustomer.name} {selectedCustomer.fhtitle}{' '}
          {selectedCustomer.fhname}
        </div>
      )}
    </>
  );
});
