import * as z from "zod"
import {useCompany} from "@/context/CompanyProvider.tsx";
import {useCallback, useEffect, useMemo} from "react";
import {Controller, useFieldArray, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {FieldGroup, FieldLabel} from "@/components/ui/field.tsx";
import {useEnterNavigation} from "@/hooks/useEnterNavigation.ts";
import {Input} from "@/components/ui/input.tsx";
import CustomerPicker from "@/components/CustomerPicker.tsx";
import ProductSelector from "@/components/ProductSelector.tsx";
import type {Tables} from "../../tables";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";

import '@/NewLoan.css';

const newLoanSchema = z.object({
    serial: z.string().min(1).max(1),
    loan_no: z.number().min(1).max(10000),
    loan_amount: z.number(),
    interest_rate: z.number(),
    first_month_interest: z.number(),
    date: z.string(),
    doc_charges: z.number(),
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
            gross_weight: z.number(),
            net_weight: z.number(),
            ignore_weight: z.number(),
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
        gross_weight: 0,
        net_weight: 0,
        ignore_weight: 0,
    }), []);

    const defaultValues = useMemo<Loan>(() => ({
        serial,
        loan_no: loanNo ? parseInt(loanNo) : 1,
        loan_amount: 0,
        interest_rate: 0,
        first_month_interest: 0,
        date: !company ? '' : company.current_date,
        doc_charges: 0,
        customer: null,
        metal_type: 'Gold',
        company: !company ? '' : company.name,
        released: 0,
        billing_items: [defaultBillingItemValues]
    }), [company, defaultBillingItemValues, loanNo, serial]);

    const {control, handleSubmit, reset, watch, setValue} = useForm<Loan>({
        resolver: zodResolver(newLoanSchema),
        defaultValues,
    })

    const selectedCustomer = watch("customer")

    const {fields, append, remove} = useFieldArray({
        name: 'billing_items',
        control,
    })

    useEffect(() => {
        if (company) {
            reset(defaultValues);
        }
    }, [company, defaultValues, reset]);

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
            `billing_items.${i}.gross_weight`,
            `billing_items.${i}.ignore_weight`,
        ]).flat();
    }, [fields]);

    const {setFormRef, next} = useEnterNavigation({
        fields: [
            "serial",
            "loan_no",
            "customer_picker",
            "metal_type",
            ...billingItemsNames,
        ],
        onSubmit: handleFormSubmit,
    });

    return <form ref={setFormRef} className="p-4">
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
                                    field.onChange(val ? parseInt(val) : "");
                                }
                            }}
                        />
                    )}
                />
            </div>
            <CustomerPicker onChange={(customer: Tables['customers']['Row']) => {
                setValue('customer', customer);
                next()
            }}/>
            {selectedCustomer ?
                <div>{selectedCustomer.name} {selectedCustomer.fhtitle} {selectedCustomer.fhname}</div> : null}
            <Controller
                name="metal_type"
                control={control}
                render={({field}) => (
                    <Select onValueChange={(value: string) => {
                        field.onChange(value);
                        next();
                    }} value={field.value}>
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
                    <FieldLabel className="px-3 py-1 w-[280px]">Product</FieldLabel>
                    <FieldLabel className="px-3 py-1 w-[280px]">Quality</FieldLabel>
                    <FieldLabel className="px-3 py-1 w-[120px]">Seal</FieldLabel>
                    <FieldLabel className="px-3 py-1 w-16 text-right">Qty</FieldLabel>
                    <FieldLabel className="px-3 py-1 w-24 text-right">Ignore Wt</FieldLabel>
                    <FieldLabel className="px-3 py-1 w-24 text-right">Gross Wt</FieldLabel>
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
                                        metalType="Gold"
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
                                            if (e.key === '/') {
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
                                        id={`billing_items.${i}.quantity`}
                                        name={`billing_items.${i}.quantity`}
                                        type="number"
                                        placeholder=""
                                        className="w-16 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                )}
                            />
                            <Controller
                                name={`billing_items.${i}.gross_weight`}
                                control={control}
                                render={({field}) => (
                                    <Input
                                        {...field}
                                        onFocus={(e) => {
                                            e.currentTarget.select();
                                        }}
                                        id={`billing_items.${i}.gross_weight`}
                                        name={`billing_items.${i}.gross_weight`}
                                        type="number"
                                        placeholder=""
                                        className="w-24 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                )}
                            />
                            <Controller
                                name={`billing_items.${i}.ignore_weight`}
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
                                            id={`billing_items.${i}.ignore_weight`}
                                            name={`billing_items.${i}.ignore_weight`}
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
        </FieldGroup>
    </form>;
}