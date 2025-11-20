import { memo, useEffect, useState } from 'react';
import CustomerPicker from '@/components/CustomerPicker';
import type { FullCustomer, Tables } from '@/../tables';
import CustomerInfo from '@/components/LoanForm/CustomerInfo.tsx';
import { read } from '@/hooks/dbUtil.ts';
import { Dialog, DialogContent } from '@/components/ui/dialog.tsx';
import CustomerCrud from '@/pages/CustomerCrud.tsx';
import { DialogTitle } from '@radix-ui/react-dialog';
import { errorToast } from '@/lib/myUtils.tsx';

interface LoanCustomerSectionProps {
  selectedCustomer: FullCustomer | null;
  onCustomerSelect: (customer: FullCustomer) => void;
}

export const LoanCustomerSection = memo(function LoanCustomerSection(
  props: LoanCustomerSectionProps
) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        e.key === 'F2' &&
        e.target instanceof HTMLInputElement &&
        e.target.name === 'customer_picker'
      ) {
        setIsModalOpen(true);
      }
    };

    window.addEventListener('keydown', listener);

    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, []);

  const onCustomerSelect = async (customer: Tables['customers']) => {
    try {
      const areaResponse = await read('areas', {
        name: customer.area,
      });
      if (areaResponse?.length) {
        props.onCustomerSelect({
          customer,
          area: areaResponse[0],
        });
        return;
      }
      errorToast('No area match');
    } catch (e) {
      errorToast(e);
    }
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
      <CustomerPicker
        onSelect={(customer: Tables['customers']) =>
          void onCustomerSelect(customer)
        }
        autofocus
        showShortcut="F2"
      />
      {props.selectedCustomer && (
        <CustomerInfo
          className="pl-3 py-2 min-h-[136px]"
          customer={props.selectedCustomer.customer}
          area={props.selectedCustomer.area}
        />
      )}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogTitle className="sr-only">Add Customer</DialogTitle>
          <CustomerCrud
            cantEdit
            onCreate={(customer: Tables['customers']) => {
              setIsModalOpen(false);
              setTimeout(() => {
                void onCustomerSelect(customer);
                document.getElementsByName('metal_type')[0].focus();
              }, 100);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
});
