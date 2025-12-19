import { useCompany } from '@/context/CompanyProvider';
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FieldGroup } from '@/components/ui/field';
import { useEnterNavigation } from '@/hooks/useEnterNavigation';
import type {
  FullCustomer,
  MetalType,
  Tables,
  TablesInsert,
} from '../../tables';
import { useLoanCalculations } from '@/hooks/useLoanCalculations';
import { LoanCustomerSection } from '@/components/LoanForm/LoanCustomerSection';
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
  DECIMAL_PRECISION,
  DEFAULT_BILLING_ITEM,
} from '@/constants/loanForm';

import '@/styles/NewLoan.css';
import { MetalTypeSelector } from '@/components/LoanForm/MetalTypeSelector.tsx';
import { LoanNumber } from '@/components/LoanForm/LoanNumber.tsx';
import DatePicker from '@/components/DatePicker.tsx';
import { create, deleteRecord, query, read, update } from '@/hooks/dbUtil.ts';
import BottomBar from '@/components/LoanForm/BottomBar.tsx';
import ConfirmationDialog from '@/components/ConfirmationDialog.tsx';
import {
  errorToast,
  getNextExistingBill,
  getNextSerial,
  getPreviousExistingBill,
  getPrevSerial,
  loadBillWithDeps,
} from '@/lib/myUtils.tsx';
import { BillingItemsTable } from '@/components/LoanForm/BillingItemsTable.tsx';
import BillsByCustomer from '@/components/LoanForm/BillsByCustomer.tsx';
import { cn } from '@/lib/utils.ts';
import GoHome from '@/components/GoHome.tsx';
import { useThanglish } from '@/context/ThanglishProvider.tsx';

export default function NewLoan() {
  const { company, setNextSerial } = useCompany();
  const { setIsTamil } = useThanglish();
  const [serial, loanNo] = useMemo(
    () => (!company ? '' : company.next_serial).split('-'),
    [company]
  );
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [loadedLoan, setLoadedLoan] = useState<Tables['full_bill'] | null>(
    null
  );
  const isEditMode = useMemo(() => loadedLoan !== null, [loadedLoan]);
  const [isDeleteConfirmation, setIsDeleteConfirmation] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const defaultValues = useMemo<Loan>(
    () => ({
      serial,
      loan_no: loanNo ?? '',
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

  const billingItemValues = useWatch({ control, name: 'billing_items' });
  const enteredSerial = useWatch({ control, name: 'serial' });
  const enteredNumber = useWatch({ control, name: 'loan_no' });

  const { title, isIncorrect } = useMemo((): {
    title: string;
    isIncorrect: boolean;
  } => {
    const typedSerial = `${enteredSerial}-${enteredNumber}`;
    const loadedLoanSerial = `${loadedLoan?.serial}-${loadedLoan?.loan_no}`;
    if (isEditMode) {
      return typedSerial === loadedLoanSerial
        ? { title: 'Edit Loan', isIncorrect: false }
        : typedSerial === company?.next_serial
          ? { title: 'Click on New Loan', isIncorrect: true }
          : { title: 'Click on Load Loan', isIncorrect: true };
    }
    return typedSerial === company?.next_serial
      ? { title: 'New Loan', isIncorrect: false }
      : { title: 'Click on Load Loan', isIncorrect: true };
  }, [
    company?.next_serial,
    enteredNumber,
    enteredSerial,
    isEditMode,
    loadedLoan?.loan_no,
    loadedLoan?.serial,
  ]);

  useEffect(() => {
    setIsTamil(true);
  }, [setIsTamil]);

  useEffect(() => {
    billingItemValues.forEach((item, index) => {
      const total = (
        parseFloat(item.ignore_weight || '0') +
        parseFloat(item.net_weight || '0')
      ).toFixed(3);
      if (total !== parseFloat(item.gross_weight).toFixed(3)) {
        setValue(`billing_items.${index}.gross_weight`, total);
      }
    });
  }, [billingItemValues, setValue]);

  const { calculateLoanAmounts, recalculateTotalFromDocCharges } =
    useLoanCalculations();

  useEffect(() => {
    if (company && !loadedLoan) {
      reset(defaultValues);
    }
  }, [company, defaultValues, reset, loadedLoan]);

  const performLoanCalculation = useCallback(
    async (
      options: {
        loanAmount?: number;
        customInterestRate?: number;
        metalType?: MetalType;
      } = {}
    ) => {
      const result = await calculateLoanAmounts(
        parseFloat(getValues('loan_amount')),
        getValues('metal_type'),
        options
      );

      if (result) {
        if (!options.customInterestRate) {
          setValue(
            'interest_rate',
            result.interestRate.toFixed(DECIMAL_PRECISION)
          );
        }
        setValue(
          'first_month_interest',
          result.firstMonthInterest.toFixed(DECIMAL_PRECISION)
        );
        setValue('doc_charges', result.docCharges.toFixed(DECIMAL_PRECISION));
        setValue('total', result.total.toFixed(DECIMAL_PRECISION));
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

  const onNewClick = () => {
    reset(defaultValues);
    setLoadedLoan(null);
  };

  const deleteLoan = async () => {
    if (isIncorrect) {
      errorToast('Loaded incorrect loan');
      return;
    }
    await deleteRecord('bill_items', {
      loan_no: parseInt(enteredNumber),
      serial: enteredSerial,
    });
    await deleteRecord('bills', {
      loan_no: parseInt(enteredNumber),
      serial: enteredSerial,
    });
    const [nextSerial, nextNumber] = getNextSerial(
      enteredSerial,
      enteredNumber
    );
    if (company?.next_serial === `${nextSerial}-${nextNumber}`) {
      await setNextSerial(`${enteredSerial}-${enteredNumber}`);
    }
    onNewClick();
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onSubmit: (data: Loan) => Promise<void> = async (data: Loan) => {
    if (!isLoanReadyForSubmit(data)) {
      errorToast('Please fill in all required fields');
      return;
    }
    if (isIncorrect) {
      const resp = await read('bills', {
        serial,
        loan_no: parseInt(loanNo),
      });
      if (resp?.length) {
        errorToast('Loaded incorrect loan');
        return;
      }
    }
    if (isEditMode) {
      setIsConfirmDialogOpen(true);
      setIsDeleteConfirmation(false);
      return;
    }
    await onCommitChanges(data);
  };

  const onLastClick = async () => {
    const [s, l] = getPrevSerial(serial, loanNo);
    await handleLoanNavigation(s, l);
  };

  const onPrevClick = async () => {
    const [s, l] = getPrevSerial(enteredSerial, '' + enteredNumber);
    const resp = await getPreviousExistingBill(s, l);
    if (!resp) {
      errorToast('No Loans Found!');
      return;
    }
    await handleLoanNavigation(resp.serial, resp.loanNo);
  };

  const onNextClick = async () => {
    const [s, l] = getNextSerial(enteredSerial, '' + enteredNumber);
    if (`${s}-${l}` === company?.next_serial) {
      onNewClick();
      return;
    }
    const resp = await getNextExistingBill(s, l);
    if (!resp) {
      errorToast('No Loans Found!');
      return;
    }
    await handleLoanNavigation(resp.serial, resp.loanNo);
  };

  const handleLoanNavigation = async (serial: string, loanNo: number) => {
    const loan = await loadBillWithDeps(serial, loanNo);
    if (!loan) {
      return;
    }
    handleEditLoan(loan);
  };

  const createProductsIfNotExist = async (
    billingItems: Loan['billing_items'],
    metalType: MetalType
  ) => {
    for (const item of billingItems) {
      const productQuery = read('products', {
        metal_type: metalType,
        product_type: 'product',
        name: item.product,
      });
      const qualityQuery = read('products', {
        metal_type: 'Other',
        product_type: 'quality',
        name: item.quality ?? '',
      });
      const sealQuery = read('products', {
        metal_type: 'Other',
        product_type: 'seal',
        name: item.extra ?? '',
      });

      const [productCountResp, qualityCountResp, sealCountResp] =
        await Promise.all([productQuery, qualityQuery, sealQuery]);
      if (!productCountResp?.length) {
        await create('products', {
          name: item.product,
          metal_type: metalType,
          product_type: 'product',
        });
      }
      if (!qualityCountResp?.length) {
        await create('products', {
          name: item.quality ?? '',
          metal_type: 'Other',
          product_type: 'quality',
        });
      }
      if (!sealCountResp?.length) {
        await create('products', {
          name: item.extra ?? '',
          metal_type: 'Other',
          product_type: 'seal',
        });
      }
    }
  };

  const onCommitChanges = async (data?: Loan) => {
    if (isCommitting) {
      return;
    }
    setIsCommitting(true);
    data ??= getValues();
    try {
      const formattedLoan: TablesInsert['bills'] = {
        serial: data.serial,
        loan_no: parseInt(data.loan_no),
        customer_id: data.customer?.customer.id ?? '',
        date: data.date,
        loan_amount: parseInt(data.loan_amount || '0'),
        interest_rate: parseFloat(data.interest_rate || '0'),
        first_month_interest: parseFloat(data.first_month_interest || '0'),
        doc_charges: parseFloat(data.doc_charges || '0'),
        metal_type: data.metal_type,
        released: 0,
        company: data.company,
      };
      const sortOrderResp = await query<
        [{ sort_order: number }]
      >(`SELECT sort_order
         FROM bill_items
         ORDER BY sort_order DESC
         LIMIT 1`);
      let sortOrder = sortOrderResp?.[0].sort_order ?? 0;
      if (sortOrder === 0) {
        throw Error('Sort Order for bill items is undefined');
      }
      const formatterProduct: TablesInsert['bill_items'][] =
        data.billing_items.map((item): TablesInsert['bill_items'] => ({
          serial: data.serial,
          loan_no: parseInt(data.loan_no),
          gross_weight: parseFloat(item.gross_weight || '0'),
          ignore_weight: parseFloat(item.ignore_weight || '0'),
          net_weight:
            parseFloat(item.net_weight || '0') +
            parseFloat(item.ignore_weight || '0'),
          product: item.product,
          quantity: item.quantity,
          quality: item.quality,
          extra: item.extra,
          sort_order: ++sortOrder,
        }));
      if (isEditMode) {
        await update('bills', formattedLoan);
        await query(
          `UPDATE bill_items
           SET synced  = 0,
               deleted = 1
           WHERE loan_no = ?
             AND serial = ?`,
          [formattedLoan.loan_no, formattedLoan.serial],
          true
        );
        for (const item of formatterProduct) {
          await create('bill_items', item);
        }
        await createProductsIfNotExist(data.billing_items, data.metal_type);
        const reloadedLoan = await loadBillWithDeps(
          enteredSerial,
          parseInt(enteredNumber)
        );
        if (reloadedLoan) {
          handleEditLoan(reloadedLoan);
        }
      } else {
        await create('bills', formattedLoan);
        for (const item of formatterProduct) {
          await create('bill_items', item);
        }
        await createProductsIfNotExist(data.billing_items, data.metal_type);
        if (
          `${formattedLoan.serial}-${formattedLoan.loan_no}` ===
          company?.next_serial
        ) {
          await setNextSerial();
        }
        setTimeout(() => next('customer_picker' as FormFieldName), 100);
      }
    } catch (error) {
      errorToast(
        error instanceof Error ? error.message : 'Failed to save loan'
      );
    } finally {
      setIsCommitting(false);
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
        createBillingItemFieldName(i, BILLING_ITEM_FIELDS.NET_WEIGHT),
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
    canMoves: {
      customer_picker: () => selectedCustomer !== null,
    },
  });

  useEffect(() => {
    if (
      selectedCustomer &&
      document.activeElement ===
        document.getElementsByName('customer_picker')[0]
    ) {
      next('metal_type');
    }
  }, [next, selectedCustomer]);

  const handleMetalTypeChange = () => {
    fieldArray.replace([DEFAULT_BILLING_ITEM as BillingItemType]);
    setTimeout(() => {
      next('billing_items.0.product');
      void performLoanCalculation();
    }, 200);
  };

  const handleOnOldLoanLoaded = (
    loan: Tables['full_bill'],
    skipSerial = false
  ) => {
    if (!skipSerial) {
      setValue('serial', loan.serial);
      setValue('loan_no', '' + loan.loan_no);
    }
    setValue('customer', loan.full_customer);
    fieldArray.replace(
      loan.bill_items.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        quality: item.quality,
        extra: item.extra,
        gross_weight: item.gross_weight.toFixed(3),
        ignore_weight: item.ignore_weight.toFixed(3),
        net_weight: item.net_weight.toFixed(3),
      }))
    );
    setValue('loan_amount', loan.loan_amount.toFixed(2));
    setValue('interest_rate', loan.interest_rate.toFixed(2));
    setValue('doc_charges', loan.doc_charges.toFixed(2));
    void performLoanCalculation();
    setTimeout(() => next('loan_amount'), 100);
  };

  const handleEditLoan = (loan: Tables['full_bill']) => {
    reset({
      date: loan.date,
      loan_amount: loan.loan_amount.toFixed(2),
      interest_rate: loan.interest_rate.toFixed(2),
      billing_items: loan.bill_items.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        quality: item.quality,
        extra: item.extra,
        gross_weight: item.gross_weight.toFixed(3),
        ignore_weight: item.ignore_weight.toFixed(3),
        net_weight: item.net_weight.toFixed(3),
      })),
      company: loan.company ?? '',
      doc_charges: loan.doc_charges.toFixed(2),
      metal_type: loan.metal_type,
      released: loan.released,
      first_month_interest: loan.first_month_interest.toFixed(2),
      customer: loan.full_customer,
      serial: loan.serial,
      loan_no: '' + loan.loan_no,
    });
    setLoadedLoan(loan);
    setTimeout(() => next('loan_amount'), 100);
  };

  return (
    <div className="h-full">
      <form
        ref={setFormRef}
        className="p-4 flex flex-1 flex-row justify-between pb-24"
      >
        <FieldGroup>
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex gap-4">
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div className="flex gap-4 items-center">
                    <GoHome />
                    <LoanNumber<Loan>
                      control={control}
                      onLoanLoad={handleEditLoan}
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
                          showDay
                        />
                      )}
                    />
                    {isEditMode && (
                      <div>
                        **{getValues('released') === 0 ? 'Active' : 'Redeemed'}
                        **
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      'text-xl',
                      isIncorrect ? 'text-destructive' : ''
                    )}
                  >
                    {title}
                  </div>
                  <LoanNumber<Loan>
                    control={control}
                    onLoanLoad={(loan) => handleOnOldLoanLoaded(loan, true)}
                    numberFieldName="old_loan_no"
                    serialFieldName="old_serial"
                    showButton
                  />
                </div>
                <div className="flex gap-6">
                  <LoanCustomerSection
                    selectedCustomer={selectedCustomer}
                    onCustomerSelect={(customer: FullCustomer) => {
                      setValue('customer', customer);
                    }}
                  />

                  <MetalTypeSelector
                    control={control}
                    onMetalTypeChange={handleMetalTypeChange}
                  />
                </div>
              </div>
              <LoanAmountSection
                control={control}
                onLoanAmountChange={handleLoanAmountChange}
                onInterestChange={handleInterestChange}
                onDocChargeChange={handleDocChargeChange}
              />
            </div>
            <BillingItemsTable
              control={control}
              metalType={metalType}
              fieldArray={fieldArray}
              onNavigateToField={(fieldName) =>
                next(fieldName as FormFieldName)
              }
            />
            {selectedCustomer && (
              <BillsByCustomer customerId={selectedCustomer.customer.id} />
            )}
          </div>
        </FieldGroup>
      </form>
      <BottomBar
        isEditMode={isEditMode}
        canGoNext={`${enteredSerial}-${enteredNumber}` !== company?.next_serial}
        onNewClick={onNewClick}
        onNextClick={() => void onNextClick()}
        onLastClick={() => void onLastClick()}
        onPrevClick={() => void onPrevClick()}
        onSaveClick={() => void handleSubmit(onSubmit)()}
        onDeleteClick={() => {
          setIsConfirmDialogOpen(true);
          setIsDeleteConfirmation(true);
        }}
      />
      <ConfirmationDialog
        title={isDeleteConfirmation ? 'Confirm Delete?' : 'Confirm Edit?'}
        onConfirm={() =>
          isDeleteConfirmation ? void deleteLoan() : void onCommitChanges()
        }
        isOpen={isConfirmDialogOpen}
        onChange={setIsConfirmDialogOpen}
        isDestructive={isDeleteConfirmation}
      >
        <div className="text-lg">
          Loan Number {enteredSerial} {enteredNumber}
        </div>
      </ConfirmationDialog>
    </div>
  );
}
