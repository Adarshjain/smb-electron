import { memo } from 'react';
import CustomerPicker from '@/components/CustomerPicker';
import type { FullCustomer, Tables } from '@/../tables';
import CustomerInfo from '@/components/LoanForm/CustomerInfo.tsx';
import { read } from '@/hooks/dbUtil.ts';
import { toast } from 'sonner';
import { toastStyles } from '@/constants/loanForm.ts';

interface LoanCustomerSectionProps {
  selectedCustomer: FullCustomer | null;
  onCustomerSelect: (customer: FullCustomer) => void;
}

export const LoanCustomerSection = memo(function LoanCustomerSection(
  props: LoanCustomerSectionProps
) {
  const onCustomerSelect = async (customer: Tables['customers']['Row']) => {
    const areaResponse = await read('areas', {
      name: customer.area,
    });
    if (areaResponse.success && areaResponse.data?.length) {
      props.onCustomerSelect({
        customer,
        area: areaResponse.data[0],
      });
      return;
    }
    toast.error('No area match', { className: toastStyles.error });
    props.onCustomerSelect({
      customer,
      area: {
        name: customer.area,
        town: null,
        post: null,
        pincode: null,
      },
    });
  };

  return (
    <div>
      <CustomerPicker onSelect={() => void onCustomerSelect} autofocus />
      {props.selectedCustomer && (
        <CustomerInfo
          className="pl-3 py-2 min-h-[136px]"
          customer={props.selectedCustomer.customer}
          area={props.selectedCustomer.area}
        />
      )}
    </div>
  );
});
