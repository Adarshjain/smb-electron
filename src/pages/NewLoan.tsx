import { useCompany } from '@/context/CompanyProvider';
import { type ChangeEvent, useCallback, useEffect, useMemo } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FieldGroup } from '@/components/ui/field';
import { useEnterNavigation } from '@/hooks/useEnterNavigation';
import type { MetalType, Tables } from '../../tables';
import { useLoanCalculations } from '@/hooks/useLoanCalculations';
import { SerialNumber } from '@/components/LoanForm/SerialNumber.tsx';
import { LoanCustomerSection } from '@/components/LoanForm/LoanCustomerSection';
import { BillingItemsTable } from '@/components/LoanForm/BillingItemsTable';
import { LoanAmountSection } from '@/components/LoanForm/LoanAmountSection';
import {
  type BillingItem,
  type BillingItem as BillingItemType,
  type FormFieldName,
  type Loan,
  newLoanSchema,
} from '@/types/loanForm';
import {
  createBillingItemFieldName,
  isLoanReadyForSubmit,
} from '@/types/loanFormHelpers';
import {
  BILLING_ITEM_FIELDS,
  DEFAULT_BILLING_ITEM,
} from '@/constants/loanForm';
import { toast } from 'sonner';

import '@/NewLoan.css';
import { MetalTypeSelector } from '@/components/LoanForm/MetalTypeSelector.tsx';
import { OldLoanFiller } from '@/components/LoanForm/OldLoanFiller.tsx';
import DatePicker from '@/components/DatePicker.tsx';
import { create } from '@/hooks/dbUtil.ts';
import { encodeRecord } from '@/lib/myUtils.tsx';
import BillAsLineItem from '@/components/LoanForm/BillAsLineItem.tsx';

export default function NewLoan() {
  const { company, setNextSerial } = useCompany();
  const [serial, loanNo] = useMemo(
    () => (!company ? '' : company.next_serial).split('-'),
    [company]
  );

  const defaultValues = useMemo<Loan>(
    () => ({
      serial,
      loan_no: loanNo ? parseInt(loanNo) : 1,
      old_loan_no: 0,
      old_serial: '',
      loan_amount: '0.00',
      total: '0.00',
      interest_rate: '0.00',
      first_month_interest: '0.00',
      date: !company ? '' : company.current_date,
      doc_charges: '0.00',
      customer: null,
      metal_type: 'Gold',
      company: !company ? '' : company.name,
      released: 0,
      billing_items: [DEFAULT_BILLING_ITEM as BillingItem],
    }),
    [company, loanNo, serial]
  );

  const { control, handleSubmit, reset, watch, setValue, getValues } =
    useForm<Loan>({
      resolver: zodResolver(newLoanSchema),
      defaultValues,
    });

  const selectedCustomer = watch('customer');
  const metalType = watch('metal_type');

  const fieldArray = useFieldArray({
    name: 'billing_items',
    control,
  });

  const { calculateLoanAmounts, recalculateTotalFromDocCharges } =
    useLoanCalculations();

  useEffect(() => {
    if (company) {
      reset(defaultValues);
    }
  }, [company, defaultValues, reset]);

  const performLoanCalculation = useCallback(
    async (
      options: {
        loanAmount?: number;
        customInterestRate?: number;
        metalType?: MetalType;
      } = {}
    ) => {
      const result = await calculateLoanAmounts(
        getValues('loan_amount'),
        getValues('metal_type'),
        options
      );

      if (result) {
        if (!options.customInterestRate) {
          setValue('interest_rate', result.interestRate);
        }
        setValue('first_month_interest', result.firstMonthInterest);
        setValue('doc_charges', result.docCharges);
        setValue('total', result.total);
      }
    },
    [calculateLoanAmounts, getValues, setValue]
  );

  const handleLoanAmountChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const loanAmount = parseFloat(value || '0');
      void performLoanCalculation({ loanAmount });
    },
    [performLoanCalculation]
  );

  const handleInterestChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const interest = e.target.value;
      void performLoanCalculation({
        customInterestRate: parseFloat(interest || '0'),
      });
    },
    [performLoanCalculation]
  );

  const handleDocChargeChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const charge = e.target.value;
      const parsed = parseFloat(charge || '0');
      const [loanAmount, fmi] = getValues([
        'loan_amount',
        'first_month_interest',
      ]);
      const newTotal = recalculateTotalFromDocCharges(loanAmount, fmi, parsed);
      setValue('doc_charges', charge);
      setValue('total', newTotal);
    },
    [getValues, setValue, recalculateTotalFromDocCharges]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onSubmit: (data: Loan) => Promise<void> = async (data: Loan) => {
    try {
      if (!isLoanReadyForSubmit(data)) {
        toast.error('Please fill in all required fields');
        return;
      }
      const formattedLoan: Tables['bills']['Insert'] = encodeRecord('bills', {
        serial: data.serial,
        loan_no: data.loan_no,
        customer_id: data.customer?.id ?? '',
        date: data.date,
        loan_amount: parseInt(data.loan_amount || '0'),
        interest_rate: parseFloat(data.interest_rate || '0'),
        first_month_interest: parseFloat(data.first_month_interest || '0'),
        doc_charges: parseFloat(data.doc_charges || '0'),
        metal_type: data.metal_type,
        released: 0,
        company: data.company,
      });
      const formatterProduct: Tables['bill_items']['Insert'][] =
        data.billing_items.map((item): Tables['bill_items']['Insert'] =>
          encodeRecord('bill_items', {
            serial: data.serial,
            loan_no: data.loan_no,
            gross_weight: parseFloat(item.gross_weight || '0'),
            ignore_weight: parseFloat(item.ignore_weight || '0'),
            net_weight:
              parseFloat(item.gross_weight || '0') +
              parseFloat(item.ignore_weight || ''),
            product: item.product,
            quantity: item.quantity,
            quality: item.quality,
            extra: item.extra,
          })
        );
      await create('bills', formattedLoan);
      for (const item of formatterProduct) {
        await create('bill_items', item);
      }
      await setNextSerial();
      queueMicrotask(() => reset(defaultValues));
      next('customer_picker');
      toast.success('Loan saved');
    } catch (error) {
      console.error('Error submitting loan:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to save loan'
      );
    }
  };

  const handleFormSubmit = useCallback(() => {
    void handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  const billingItemsNames: FormFieldName[] = useMemo(() => {
    return fieldArray.fields
      .map((_, i) => [
        createBillingItemFieldName(i, BILLING_ITEM_FIELDS.PRODUCT),
        createBillingItemFieldName(i, BILLING_ITEM_FIELDS.QUALITY),
        createBillingItemFieldName(i, BILLING_ITEM_FIELDS.EXTRA),
        createBillingItemFieldName(i, BILLING_ITEM_FIELDS.QUANTITY),
        createBillingItemFieldName(i, BILLING_ITEM_FIELDS.IGNORE_WEIGHT),
        createBillingItemFieldName(i, BILLING_ITEM_FIELDS.GROSS_WEIGHT),
      ])
      .flat();
  }, [fieldArray.fields]);

  const { setFormRef, next } = useEnterNavigation<FormFieldName>({
    fields: [
      'serial',
      'loan_no',
      'customer_picker',
      'metal_type',
      ...billingItemsNames,
      'loan_amount',
      'doc_charges',
    ],
    onSubmit: handleFormSubmit,
  });

  const handleMetalTypeChange = () => {
    fieldArray.replace([DEFAULT_BILLING_ITEM as BillingItemType]);
    queueMicrotask(() => {
      next('billing_items.0.product');
      void performLoanCalculation();
    });
  };

  const handleOnOldLoadLoaded = (loan: Tables['full_bill']['Row']) => {
    setValue('customer', loan.customer);
    fieldArray.replace(
      loan.bill_items.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        quality: item.quality,
        extra: item.extra,
        gross_weight: item.gross_weight.toFixed(2),
        ignore_weight: item.ignore_weight.toFixed(2),
        net_weight: item.net_weight.toFixed(2),
      }))
    );
    setValue('loan_amount', loan.loan_amount.toFixed(2));
    void performLoanCalculation();
    setTimeout(() => next('loan_amount'), 100);
  };

  return (
    <form ref={setFormRef} className="p-4 flex flex-row justify-between">
      <div className="flex flex-1">
        <FieldGroup className="gap-3">
          <div className="flex gap-4">
            <SerialNumber
              control={control}
              serialFieldName="serial"
              numberFieldName="loan_no"
            />
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
            <OldLoanFiller
              control={control}
              onOldLoanLoad={handleOnOldLoadLoaded}
            />
          </div>

          <div className="flex gap-6">
            <LoanCustomerSection
              selectedCustomer={selectedCustomer}
              onCustomerChange={(customer: Tables['customers']['Row']) => {
                setValue('customer', customer);
              }}
            />

            <MetalTypeSelector
              control={control}
              onMetalTypeChange={handleMetalTypeChange}
            />
          </div>
          <BillingItemsTable
            control={control}
            metalType={metalType}
            fieldArray={fieldArray}
            onNavigateToField={(fieldName) => next(fieldName)}
          />

          {selectedCustomer && (
            <BillAsLineItem customerId={selectedCustomer.id} />
          )}
        </FieldGroup>
      </div>
      <div>
        <LoanAmountSection
          control={control}
          onLoanAmountChange={handleLoanAmountChange}
          onInterestChange={handleInterestChange}
          onDocChargeChange={handleDocChargeChange}
        />
      </div>
    </form>
  );
}
