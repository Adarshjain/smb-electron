import * as z from "zod"
import {useCompany} from "@/context/CompanyProvider.tsx";
import {type ChangeEvent, useCallback, useEffect, useMemo} from "react";
import {Controller, useFieldArray, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {FieldGroup, FieldLabel} from "@/components/ui/field.tsx";
import {useEnterNavigation} from "@/hooks/useEnterNavigation.ts";
import {Input} from "@/components/ui/input.tsx";
import CustomerPicker from "@/components/CustomerPicker.tsx";
import ProductSelector from "@/components/ProductSelector.tsx";
import type {MetalType, Tables} from "../../tables";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";

import '@/NewLoan.css';
import {getDocCharges, getInterest, getRate} from "@/lib/myUtils.tsx";

const newLoanSchema = z.object({
    serial: z.string().min(1).max(1),
    loan_no: z.number().min(1).max(10000),
    loan_amount: z.string(),
    interest_rate: z.string(),
    first_month_interest: z.string(),
    total: z.string(),
    date: z.string(),
    doc_charges: z.string(),
    customer: z.custom<Tables['customers']['Row']>().nullable(),
    metal_type: z.enum(['Gold', 'Silver']),
    company: z.string(),
    released: z.number().min(0).max(1),
    billing_items: z.array(
        z.object({
            product: z.string(),
            quality: z.string(),
            extra: z.string(),
            quantity: z.number(),
            gross_weight: z.string(),
            net_weight: z.string(),
            ignore_weight: z.string(),
        })
    ).min(1)
})

type Loan = z.infer<typeof newLoanSchema>

export default function NewLoan() {
    const {company} = useCompany()
    const [serial, loanNo] = useMemo(() => (!company ? '' : company.next_serial).split('-'), [company])

    const defaultBillingItemValues = useMemo(() => ({
        product: "",
        quality: "",
        extra: "",
        quantity: 0,
        gross_weight: "0.00",
        net_weight: "0.00",
        ignore_weight: "0.00",
    }), []);

    const defaultValues = useMemo<Loan>(() => ({
        serial,
        loan_no: loanNo ? parseInt(loanNo) : 1,
        loan_amount: "0.00",
        total: "0.00",
        interest_rate: "0.00",
        first_month_interest: "0.00",
        date: !company ? '' : company.current_date,
        doc_charges: "0.00",
        customer: null,
        metal_type: 'Gold',
        company: !company ? '' : company.name,
        released: 0,
        billing_items: [defaultBillingItemValues]
    }), [company, defaultBillingItemValues, loanNo, serial]);

    const {control, handleSubmit, reset, watch, setValue, getValues} = useForm<Loan>({
        resolver: zodResolver(newLoanSchema),
        defaultValues,
    })

    const selectedCustomer = watch("customer")
    const metalType = watch("metal_type")
    const values = watch()

    const {fields, append, remove, replace} = useFieldArray({
        name: 'billing_items',
        control,
    })

    useEffect(() => {
        if (company) {
            reset(defaultValues);
        }
    }, [company, defaultValues, reset]);

    const calculateLoanAmounts = useCallback(async (options: {
        loanAmount?: number,
        customInterestRate?: number,
        metalType?: MetalType
    } = {}) => {
        const { loanAmount: newLoanAmount, customInterestRate, metalType: newMetalType } = options;

        const loanAmount = newLoanAmount ?? parseFloat(getValues('loan_amount') || "0");
        const metalType = newMetalType ?? getValues('metal_type');

        const rateConfig = await getRate(loanAmount, metalType);
        if (!rateConfig) { // will never happen
            return;
        }

        const interestRate = customInterestRate ?? rateConfig.rate;

        let docCharges = await getDocCharges(loanAmount, rateConfig);
        const fmi = getInterest(loanAmount, interestRate);
        const decimal = ((loanAmount - fmi - docCharges) % 1)
        if (decimal < 0.5) {
            docCharges += decimal;
        } else {
            docCharges -= 1 - decimal;
        }
        const total = loanAmount - fmi - docCharges;

        if (!options.customInterestRate) {
            setValue('interest_rate', interestRate.toFixed(2));
        }
        setValue('first_month_interest', fmi.toFixed(2));
        setValue('doc_charges', docCharges.toFixed(2));
        setValue('total', total.toFixed(2));
    }, [getValues, setValue]);

    const handleLoanAmountChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const loanAmount = parseFloat(value || "0");
        setValue('loan_amount', value);
        await calculateLoanAmounts({loanAmount});
    }, [calculateLoanAmounts, setValue]);

    const handleInterestChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
        const interest = e.target.value;
        setValue('interest_rate', interest);
        await calculateLoanAmounts({customInterestRate: parseFloat(interest || "0")});
    }, [calculateLoanAmounts, setValue]);

    const onSubmit = useCallback(async (data: Loan) => {
        console.log(data);
    }, []);

    const handleFormSubmit = useCallback(() => {
        handleSubmit(onSubmit)();
    }, [handleSubmit, onSubmit]);

    const billingItemsNames: string[] = useMemo(() => {
        return fields.map((_, i) => [
            `billing_items.${i}.product`,
            `billing_items.${i}.quality`,
            `billing_items.${i}.extra`,
            `billing_items.${i}.quantity`,
            `billing_items.${i}.ignore_weight`,
            `billing_items.${i}.gross_weight`,
        ]).flat();
    }, [fields]);

    const {setFormRef, next} = useEnterNavigation({
        fields: [
            "serial",
            "loan_no",
            "customer_picker",
            "metal_type",
            ...billingItemsNames,
            "loan_amount",
            "doc_charges",
        ],
        onSubmit: handleFormSubmit,
    });

    return <form ref={setFormRef} className="p-4 flex flex-row justify-between">
        <div className="flex w-[1000px]">
            <FieldGroup className="gap-3">
                <div className="flex">
                    <Controller
                        name="serial"
                        control={control}
                        render={({field, fieldState}) => (
                            <Input
                                {...field}
                                id="serial"
                                name="serial"
                                autoFocus
                                maxLength={1}
                                placeholder="A"
                                aria-invalid={fieldState.invalid}
                                className="w-14 rounded-r-none text-center uppercase focus-visible:z-10"
                            />
                        )}
                    />
                    <Controller
                        name="loan_no"
                        control={control}
                        render={({field, fieldState}) => (
                            <Input
                                {...field}
                                id="loan_no"
                                name="loan_no"
                                type="number"
                                placeholder="1"
                                aria-invalid={fieldState.invalid}
                                className="w-24 rounded-l-none border-l-0 text-center focus-visible:z-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (/^\d{0,5}$/.test(val)) {
                                        field.onChange(val ? parseInt(val) : 1);
                                    }
                                }}
                            />
                        )}
                    />
                </div>
                <CustomerPicker onChange={(customer: Tables['customers']['Row']) => {
                    setValue('customer', customer);
                }}/>
                {selectedCustomer ?
                    <div>{selectedCustomer.name} {selectedCustomer.fhtitle} {selectedCustomer.fhname}</div> : null}
                <Controller
                    name="metal_type"
                    control={control}
                    render={({field}) => (
                        <Select
                            onValueChange={(value: string) => {
                                field.onChange(value);
                                replace([defaultBillingItemValues]);
                                setTimeout(async () => {
                                    next(false, `billing_items.0.product`)
                                    await calculateLoanAmounts();
                                }, 100)
                            }}
                            value={field.value}
                        >
                            <SelectTrigger name="metal_type" className="w-60">
                                <SelectValue placeholder="Meta Type"/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Gold">Gold</SelectItem>
                                <SelectItem value="Silver">Silver</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
                <div>
                    <div className="flex input-matrix-title">
                        <FieldLabel className="block px-3 py-1 w-[280px]">Product</FieldLabel>
                        <FieldLabel className="block px-3 py-1 w-[280px]">Quality</FieldLabel>
                        <FieldLabel className="block px-3 py-1 w-[120px]">Seal</FieldLabel>
                        <FieldLabel className="block px-3 py-1 w-16 text-right">Qty</FieldLabel>
                        <FieldLabel className="block px-3 py-1 w-24 text-right">Ignore Wt</FieldLabel>
                        <FieldLabel className="block px-3 py-1 w-24 text-right">Gross Wt</FieldLabel>
                    </div>
                    <div className="flex input-matrix flex-col">
                        {fields.map((_, i) => (
                            <div className="flex" key={i}>
                                <Controller
                                    name={`billing_items.${i}.product`}
                                    control={control}
                                    render={({field}) => (
                                        <ProductSelector
                                            onChange={field.onChange}
                                            onFocus={(e) => {
                                                e.currentTarget.select();
                                            }}
                                            productType="product"
                                            metalType={metalType}
                                            inputName={`billing_items.${i}.product`}
                                            placeholder=""
                                            triggerWidth="min-w-[280px]"
                                        />
                                    )}
                                />
                                <Controller
                                    name={`billing_items.${i}.quality`}
                                    control={control}
                                    render={({field}) => (
                                        <ProductSelector
                                            onChange={field.onChange}
                                            onFocus={(e) => {
                                                e.currentTarget.select();
                                            }}
                                            productType="quality"
                                            metalType="Other"
                                            inputName={`billing_items.${i}.quality`}
                                            placeholder=""
                                            triggerWidth="min-w-[280px]"
                                        />
                                    )}
                                />
                                <Controller
                                    name={`billing_items.${i}.extra`}
                                    control={control}
                                    render={({field}) => (
                                        <ProductSelector
                                            onKeyDown={(e) => {
                                                if (e.key === '/') { // TODO: change to plus key
                                                    append(defaultBillingItemValues)
                                                    setTimeout(() => next(false, `billing_items.${i + 1}.product`), 10)
                                                }
                                            }}
                                            onFocus={(e) => {
                                                e.currentTarget.select();
                                            }}
                                            onChange={field.onChange}
                                            productType="seal"
                                            metalType="Other"
                                            inputName={`billing_items.${i}.extra`}
                                            placeholder=""
                                            triggerWidth="min-w-[120px] w-[120px] max-w-[120px]"
                                        />
                                    )}
                                />
                                <Controller
                                    name={`billing_items.${i}.quantity`}
                                    control={control}
                                    render={({field}) => (
                                        <Input
                                            {...field}
                                            onFocus={(e) => {
                                                e.currentTarget.select();
                                            }}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                field.onChange(val ? parseFloat(val) : 0);
                                            }}
                                            id={`billing_items.${i}.quantity`}
                                            name={`billing_items.${i}.quantity`}
                                            type="number"
                                            placeholder=""
                                            className="w-16 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                    )}
                                />
                                <Controller
                                    name={`billing_items.${i}.ignore_weight`}
                                    control={control}
                                    render={({field}) => (
                                        <Input
                                            {...field}
                                            onFocus={(e) => {
                                                e.currentTarget.select();
                                            }}
                                            onBlur={() => {
                                                field.onChange(parseFloat(field.value || "0").toFixed(2))
                                            }}
                                            id={`billing_items.${i}.ignore_weight`}
                                            name={`billing_items.${i}.ignore_weight`}
                                            type="number"
                                            placeholder=""
                                            className="w-24 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                    )}
                                />
                                <Controller
                                    name={`billing_items.${i}.gross_weight`}
                                    control={control}
                                    render={({field}) => (
                                        <div>
                                            <Input
                                                onKeyDown={(e) => {
                                                    if (e.key === '/') {
                                                        append(defaultBillingItemValues)
                                                        setTimeout(() => next(false, `billing_items.${i + 1}.product`), 10)
                                                    }
                                                    if (e.key === '-') {
                                                        if (fields.length > 1) {
                                                            remove(i);
                                                        }
                                                    }
                                                }}

                                                {...field}
                                                onFocus={(e) => {
                                                    e.currentTarget.select();
                                                }}
                                                onBlur={() => {
                                                    field.onChange(parseFloat(field.value || "0").toFixed(2))
                                                }}
                                                id={`billing_items.${i}.gross_weight`}
                                                name={`billing_items.${i}.gross_weight`}
                                                type="number"
                                                placeholder=""
                                                className="w-24 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                    )}
                                />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col">
                    <Controller
                        name="loan_amount"
                        control={control}
                        render={({field}) => (
                            <Input
                                {...field}
                                onFocus={(e) => {
                                    e.currentTarget.select();
                                }}
                                onChange={handleLoanAmountChange}
                                onBlur={() => {
                                    field.onChange(parseFloat(field.value || "0").toFixed(2))
                                }}
                                id="loan_amount"
                                name="loan_amount"
                                type="number"
                                placeholder="Amount"
                                className="w-60 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        )}
                    />
                    <Controller
                        name="interest_rate"
                        control={control}
                        render={({field}) => (
                            <Input
                                {...field}
                                onFocus={(e) => {
                                    e.currentTarget.select();
                                }}
                                onChange={handleInterestChange}
                                onBlur={() => {
                                    field.onChange(parseFloat(field.value || "0").toFixed(2))
                                }}
                                id="interest_rate"
                                name="interest_rate"
                                type="number"
                                placeholder=""
                                className="w-60 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        )}
                    />
                    <Controller
                        name="first_month_interest"
                        control={control}
                        render={({field}) => (
                            <Input
                                {...field}
                                disabled
                                onFocus={(e) => {
                                    e.currentTarget.select();
                                }}
                                onBlur={() => {
                                    field.onChange(parseFloat(field.value || "0").toFixed(2))
                                }}
                                id="first_month_interest"
                                name="first_month_interest"
                                type="number"
                                placeholder="FMI"
                                className="w-60 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        )}
                    />
                    <Controller
                        name="doc_charges"
                        control={control}
                        render={({field}) => (
                            <Input
                                {...field}
                                onFocus={(e) => {
                                    e.currentTarget.select();
                                }}
                                onBlur={() => {
                                    field.onChange(parseFloat(field.value || "0").toFixed(2))
                                }}
                                id="doc_charges"
                                name="doc_charges"
                                type="number"
                                placeholder="FMI"
                                className="w-60 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        )}
                    />
                    <Controller
                        name="total"
                        control={control}
                        render={({field}) => (
                            <Input
                                {...field}
                                disabled
                                onFocus={(e) => {
                                    e.currentTarget.select();
                                }}
                                onBlur={() => {
                                    field.onChange(parseFloat(field.value || "0").toFixed(2))
                                }}
                                id="total"
                                name="total"
                                type="number"
                                placeholder="Total"
                                className="w-60 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        )}
                    />
                </div>
            </FieldGroup>
        </div>
        <pre>{JSON.stringify(values, null, 2)}</pre>
    </form>;
}