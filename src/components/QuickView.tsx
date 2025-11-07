import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import CustomerPicker from '@/components/CustomerPicker.tsx';
import { useEnterNavigation } from '@/hooks/useEnterNavigation.ts';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useState,
} from 'react';
import BillsByCustomer from '@/components/LoanForm/BillsByCustomer.tsx';
import { SerialNumber } from '@/components/LoanForm/SerialNumber.tsx';
import { read } from '@/hooks/dbUtil';
import { toastElectronResponse } from '@/lib/myUtils.tsx';

export const QuickViewSchema = z.object({
  serial: z.string().length(1),
  loan_no: z.number(),
});
export type IQuickView = z.infer<typeof QuickViewSchema>;

export default function QuickView() {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const defaultValues: IQuickView = {
    serial: '',
    loan_no: 0,
  };

  const { control, setValue, watch } = useForm<IQuickView>({
    resolver: zodResolver(QuickViewSchema),
    defaultValues,
  });

  const { setFormRef, next } = useEnterNavigation({
    fields: ['serial', 'loan_no'],
  });

  const [serial, loanNo] = watch(['serial', 'loan_no']);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !(
          e.target instanceof HTMLBodyElement ||
          (e.target instanceof HTMLInputElement && e.target.name === 'serial')
        )
      ) {
        return;
      }
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        const upperCaseValue = e.key.toUpperCase();
        setValue('serial', upperCaseValue);
        next('loan_no');
        setTimeout(() => {
          (
            document.getElementsByName('loan_no')[0] as HTMLInputElement
          ).select();
        }, 0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [next, setValue]);

  async function onLoanNumberInput(e?: ReactKeyboardEvent<HTMLInputElement>) {
    if (e) e.preventDefault();
    if (!serial || !loanNo) {
      return;
    }
    const readBillsResponse = await read(
      'bills',
      {
        serial,
        loan_no: loanNo,
      },
      'customer_id'
    );
    toastElectronResponse(readBillsResponse, undefined, true);
    if (readBillsResponse.success && readBillsResponse.data?.length) {
      setCustomerId(readBillsResponse.data[0].customer_id);
    }
  }

  return (
    <div ref={setFormRef} className="grid gap-2">
      <div>Quick View</div>
      <div className="flex gap-2">
        <SerialNumber
          control={control}
          serialFieldName="serial"
          numberFieldName="loan_no"
          onNumFieldKeyDown={(e) => void onLoanNumberInput(e)}
        />
        <CustomerPicker
          inputClassName="w-[400px]"
          onSelect={(customer) => setCustomerId(customer.id)}
        />
      </div>
      {customerId && (
        <BillsByCustomer
          showCustomerInfo
          customerId={customerId}
          skipReleased={false}
        />
      )}
    </div>
  );
}
