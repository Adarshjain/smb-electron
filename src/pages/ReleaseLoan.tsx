import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useEnterNavigation } from '@/hooks/useEnterNavigation.ts';
import { type ReleaseLoan, releaseLoanSchema } from '@/types/loanForm.ts';
import { useCompany } from '@/context/CompanyProvider.tsx';
import DatePicker from '@/components/DatePicker.tsx';
import { LoanNumber } from '@/components/LoanForm/LoanNumber.tsx';
import type { Tables } from '@/../tables';
import { create, deleteRecord, read, update } from '@/hooks/dbUtil.ts';
import { getInterest, getMonthDiff, viewableDate } from '@/lib/myUtils.tsx';
import CustomerInfo from '@/components/LoanForm/CustomerInfo.tsx';
import BillItemsInfo from '@/components/LoanForm/BillItemsInfo.tsx';
import { ReleaseLoanAmountSection } from '@/components/LoanForm/ReleaseLoanAmountSection.tsx';
import { Label } from '@/components/ui/label';

export default function ReleaseLoan() {
  const { company } = useCompany();
  const defaultValues = useMemo<ReleaseLoan>(
    () => ({
      serial: '',
      loan_no: 0,
      date: company?.current_date ?? '',
      interest_amount: '',
      loan_amount: '',
      total_amount: '',
      interest_rate: '',
      company: company?.name ?? '',
      released: 0,
      total_months: 0,
    }),
    [company?.current_date, company?.name]
  );
  const [loadedLoan, setLoadedLoan] = useState<
    Tables['full_bill']['Row'] | null
  >(null);

  const { control, handleSubmit, getValues, reset, setValue } =
    useForm<ReleaseLoan>({
      resolver: zodResolver(releaseLoanSchema),
      defaultValues,
    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onSubmit = async (data: ReleaseLoan) => {
    if (loadedLoan?.released === 0) {
      await create('releases', {
        serial: data.serial,
        loan_no: data.loan_no,
        date: company?.current_date ?? viewableDate(),
        loan_amount: parseFloat(data.loan_amount ?? 0),
        interest_amount: parseFloat(data.interest_amount ?? 0),
        total_amount: parseFloat(data.total_amount ?? 0),
        company: data.company,
      });
      await update('bills', {
        serial: data.serial,
        loan_no: data.loan_no,
        released: 1,
      });
      reset({
        date: data.date,
        loan_no: data.loan_no,
        serial: data.serial,
        released: 1,
        loan_amount: data.loan_amount,
        interest_amount: data.interest_amount,
        interest_rate: data.interest_rate,
        total_amount: data.total_amount,
        total_months: data.total_months,
        company: data.company,
      });
    } else {
      await deleteRecord('releases', {
        serial: data.serial,
        loan_no: data.loan_no,
      });
      await update('bills', {
        serial: data.serial,
        loan_no: data.loan_no,
        released: 0,
      });
      reset({
        date: data.date,
        loan_no: data.loan_no,
        serial: data.serial,
        released: 0,
        loan_amount: data.loan_amount,
        interest_amount: data.interest_amount,
        interest_rate: data.interest_rate,
        total_amount: data.total_amount,
        total_months: data.total_months,
        company: data.company,
      });
    }
    next('loan_no');
  };

  const handleFormSubmit = useCallback(() => {
    void handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  const { setFormRef, next } = useEnterNavigation<keyof ReleaseLoan>({
    fields: ['serial', 'loan_no', ''],
    onSubmit: handleFormSubmit,
    submitField: 'interest_amount',
  });

  const interestAmount = useWatch({ control, name: 'interest_amount' });

  useEffect(() => {
    if (!loadedLoan) {
      return;
    }
    const total = (loadedLoan.loan_amount + parseFloat(interestAmount)).toFixed(
      2
    );
    if (total !== getValues('total_amount')) {
      setValue('total_amount', total);
    }
  }, [getValues, interestAmount, loadedLoan, setValue]);

  const handleOnOldLoanLoaded = async (loan: Tables['full_bill']['Row']) => {
    if (loan.released === 1) {
      const releaseResp = await read('releases', {
        serial: loan.serial,
        loan_no: loan.loan_no,
      });
      if (releaseResp.success && releaseResp.data?.length) {
        const release = releaseResp.data[0];
        const monthDiff = getMonthDiff(loan.date, release.date);
        reset({
          date: release.date,
          loan_no: loan.loan_no,
          serial: loan.serial,
          released: 1,
          loan_amount: loan.loan_amount.toFixed(2),
          interest_amount: release.interest_amount.toFixed(2),
          interest_rate: loan.interest_rate.toFixed(2),
          total_amount: release.total_amount.toFixed(2),
          total_months: monthDiff,
        });
      }
      setLoadedLoan(loan);
      setTimeout(() => next('interest_amount'), 20);
      return;
    }
    const monthDiff = getMonthDiff(loan.date, company?.current_date);
    const interestAmount = getInterest(
      loan.loan_amount,
      loan.interest_rate,
      monthDiff
    );
    reset({
      date: company?.current_date,
      loan_no: loan.loan_no,
      serial: loan.serial,
      released: 0,
      interest_rate: loan.interest_rate.toFixed(2),
      loan_amount: loan.loan_amount.toFixed(2),
      interest_amount: interestAmount.toFixed(2),
      total_amount: (loan.loan_amount + interestAmount).toFixed(2),
      total_months: monthDiff,
    });
    setLoadedLoan(loan);
    setTimeout(() => next('interest_amount'), 20);
  };

  return (
    <div className="h-full">
      <form
        ref={setFormRef}
        className="p-4 flex flex-1 flex-row justify-between pb-24 gap-4"
      >
        <div className="flex-1">
          <div className="flex flex-1 flex-row gap-4 items-center">
            <div className="flex flex-col gap-1">
              <Label>Loan Number</Label>
              <LoanNumber<ReleaseLoan>
                control={control}
                serialFieldName="serial"
                numberFieldName="loan_no"
                onLoanLoad={handleOnOldLoanLoaded}
                autoFocus
              />
            </div>
            {loadedLoan && (
              <>
                <div className="flex flex-col gap-1">
                  <Label>Loan Date</Label>
                  <DatePicker
                    className="w-27.5 opacity-100"
                    id="date"
                    name="date"
                    defaultValue={loadedLoan.date}
                    disabled
                  />
                </div>
                <div className="animate-caret-blink text-center flex-1 [animation-duration:1000ms]">
                  **{getValues('released') === 0 ? 'Active' : 'Redeemed'}
                  **
                </div>
              </>
            )}
          </div>
          {loadedLoan && (
            <div>
              <CustomerInfo
                className="pl-3 pt-3 pb-7 min-h-[150px]"
                customer={loadedLoan.full_customer.customer}
                area={loadedLoan.full_customer.area}
              />
              <BillItemsInfo items={loadedLoan.bill_items} />
            </div>
          )}
        </div>
        {loadedLoan && (
          <div>
            <div className="text-lg text-center mb-4 mt-2 flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <Label>Release Date</Label>
                <Controller
                  name="date"
                  control={control}
                  render={({ field, fieldState }) => (
                    <DatePicker
                      className="w-27.5"
                      {...field}
                      id="date"
                      name="date"
                      isError={fieldState.invalid}
                    />
                  )}
                />
              </div>
              {getValues('total_months')} Months
            </div>
            <ReleaseLoanAmountSection
              control={control}
              onInterestChange={(e: ChangeEvent<HTMLInputElement>) => {
                setValue('interest_amount', e.target.value);
              }}
            />
          </div>
        )}
      </form>
    </div>
  );
}
