import {useCompany} from '@/context/CompanyProvider';
import {type ChangeEvent, useCallback, useEffect, useMemo} from 'react';
import {useFieldArray, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {FieldGroup} from '@/components/ui/field';
import {useEnterNavigation} from '@/hooks/useEnterNavigation';
import type {MetalType, Tables} from '../../tables';
import {useLoanCalculations} from '@/hooks/useLoanCalculations';
import {SerialNumber} from '@/components/LoanForm/SerialNumber.tsx';
import {LoanCustomerSection} from '@/components/LoanForm/LoanCustomerSection';
import {BillingItemsTable} from '@/components/LoanForm/BillingItemsTable';
import {LoanAmountSection} from '@/components/LoanForm/LoanAmountSection';
import {
    type BillingItem,
    type BillingItem as BillingItemType,
    type FormFieldName,
    type Loan,
    newLoanSchema
} from '@/types/loanForm';
import {createBillingItemFieldName, isLoanReadyForSubmit} from '@/types/loanFormHelpers';
import {BILLING_ITEM_FIELDS, DEFAULT_BILLING_ITEM, TIMING} from '@/constants/loanForm';
import {toast} from 'sonner';

import '@/NewLoan.css';
import {MetalTypeSelector} from "@/components/LoanForm/MetalTypeSelector.tsx";

export default function NewLoan() {
    const {company} = useCompany();
    const [serial, loanNo] = useMemo(() => (!company ? '' : company.next_serial).split('-'), [company]);

    const defaultValues = useMemo<Loan>(
        () => ({
            serial,
            loan_no: loanNo ? parseInt(loanNo) : 1,
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

    const {control, handleSubmit, reset, watch, setValue, getValues} = useForm<Loan>({
        resolver: zodResolver(newLoanSchema),
        defaultValues,
    });

    const selectedCustomer = watch('customer');
    const metalType = watch('metal_type');

    const fieldArray = useFieldArray({
        name: 'billing_items',
        control,
    });

    const {
        calculateLoanAmounts,
        recalculateTotalFromDocCharges,
    } = useLoanCalculations();

    useEffect(() => {
        if (company) {
            reset(defaultValues);
        }
    }, [company, defaultValues, reset]);

    const performLoanCalculation = useCallback(
        async (options: {
            loanAmount?: number,
            customInterestRate?: number,
            metalType?: MetalType
        } = {}) => {
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
            performLoanCalculation({loanAmount});
        },
        [performLoanCalculation]
    );

    const handleInterestChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const interest = e.target.value;
            performLoanCalculation({customInterestRate: parseFloat(interest || '0')});
        },
        [performLoanCalculation]
    );

    const handleDocChargeChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const charge = e.target.value;
            const parsed = parseFloat(charge || '0');
            const [loanAmount, fmi] = getValues(['loan_amount', 'first_month_interest']);
            const newTotal = recalculateTotalFromDocCharges(loanAmount, fmi, parsed);
            setValue('doc_charges', charge);
            setValue('total', newTotal);
        },
        [getValues, setValue, recalculateTotalFromDocCharges]
    );

    const onSubmit = useCallback(
        async (data: Loan) => {
            try {
                if (!isLoanReadyForSubmit(data)) {
                    toast.error('Please fill in all required fields');
                    return;
                }

                console.log('Loan data submitted:', data);
                toast.success('Loan saved successfully!');
            } catch (error) {
                console.error('Error submitting loan:', error);
                toast.error(error instanceof Error ? error.message : 'Failed to save loan');
            }
        },
        []
    );

    const handleFormSubmit = useCallback(() => {
        handleSubmit(onSubmit)();
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

    const {setFormRef, next} = useEnterNavigation<FormFieldName>({
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
        setTimeout(async () => {
            next(false, 'billing_items.0.product');
            await performLoanCalculation();
        }, TIMING.METAL_TYPE_CHANGE_DELAY);
    };


    return (
        <form ref={setFormRef} className="p-4 flex flex-row justify-between">
            <div className="flex flex-1">
                <FieldGroup className="gap-3">
                    <SerialNumber
                        control={control}
                        serialFieldName="serial"
                        numberFieldName="loan_no"
                    />

                    <LoanCustomerSection
                        selectedCustomer={selectedCustomer}
                        onCustomerChange={(customer: Tables['customers']['Row']) => {
                            setValue('customer', customer);
                        }}
                    />

                    <MetalTypeSelector control={control} onMetalTypeChange={handleMetalTypeChange}/>

                    <BillingItemsTable
                        control={control}
                        metalType={metalType}
                        fieldArray={fieldArray}
                        onNavigateToField={(fieldName) => next(false, fieldName)}
                    />

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
            {/*<pre className="text-xs">{JSON.stringify(values, null, 2)}</pre>*/}
        </form>
    );
}
