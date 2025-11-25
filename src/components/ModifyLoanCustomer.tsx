import { Dialog, DialogContent } from '@/components/ui/dialog.tsx';
import { DialogTitle } from '@radix-ui/react-dialog';
import type { LocalTables } from '../../tables';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CustomerPicker from '@/components/CustomerPicker.tsx';
import CustomerInfo from '@/components/LoanForm/CustomerInfo.tsx';
import { useEffect, useState } from 'react';
import CustomerCrud from '@/pages/CustomerCrud.tsx';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';

export default function ModifyLoanCustomer({
  bill,
  onSave,
  onClose,
  existingCustomer,
}: {
  bill: LocalTables<'bills'> | null;
  existingCustomer: LocalTables<'customers'> | null;
  onSave: (customerId: string) => void;
  onClose: () => void;
}) {
  const [tempCustomer, setTempCustomer] =
    useState<LocalTables<'customers'> | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('new-cust');

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        setCurrentTab('new-cust');
      }
      if (e.key === 'F3') {
        setCurrentTab('existing');
      }
    };

    window.addEventListener('keydown', listener);

    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, []);

  return (
    <Dialog
      open={bill !== null}
      onOpenChange={(isOpen) => (!isOpen ? onClose() : null)}
    >
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        className="!p-0"
      >
        <div
          className="gap-2 flex flex-col p-4"
          style={{ maxWidth: 'calc(100% - var(--spacing) * 5)' }}
        >
          <DialogTitle>Change Customer</DialogTitle>
          <div className="flex gap-2">
            <div>
              {bill?.serial} {bill?.loan_no}
            </div>
            {existingCustomer && <CustomerInfo customer={existingCustomer} />}
          </div>
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="w-full">
              <TabsTrigger value="existing">
                <Kbd className="border-input border">F3</Kbd>
                Existing Customer
              </TabsTrigger>
              <TabsTrigger value="new-cust">
                <Kbd className="border-input border">F2</Kbd>
                New Customer
              </TabsTrigger>
            </TabsList>
            <TabsContent value="existing" className="flex flex-col gap-2">
              <CustomerPicker
                inputClassName="w-[480px]"
                placeholder="Search Customer"
                onSelect={(customer: LocalTables<'customers'>) =>
                  setTempCustomer(customer)
                }
                autofocus
              />
              {tempCustomer && <CustomerInfo customer={tempCustomer} />}
              <Button
                disabled={!tempCustomer}
                className="w-full"
                onClick={() => onSave(tempCustomer?.id ?? '')}
              >
                Save
              </Button>
            </TabsContent>
            <TabsContent value="new-cust">
              <CustomerCrud
                cantEdit
                onCreate={({ id }: LocalTables<'customers'>) => onSave(id)}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
