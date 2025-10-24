import * as z from "zod"
import {useCompany} from "@/context/CompanyProvider.tsx";
import {type JSX, useCallback, useEffect, useMemo} from "react";
import {Controller, type ControllerRenderProps, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field.tsx";
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
    interest_rate: z.float32(),
    first_month_interest: z.float32(),
    date: z.string(),
    doc_charges: z.float32(),
    customer: z.custom<Tables['customers']['Row']>().nullable(),
    metal_type: z.enum(['Gold', 'Silver']),
    company: z.string(),
    released: z.number().min(0).max(1)
})

type Loan = z.infer<typeof newLoanSchema>

export default function NewLoan() {
    const {company} = useCompany()
    const [serial, loanNo] = useMemo(() => (!company ? '' : company.next_serial).split('-'), [company])

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
    }), [company, loanNo, serial]);

    const {control, handleSubmit, reset, watch, setValue} = useForm<Loan>({
        resolver: zodResolver(newLoanSchema),
        defaultValues,
    })

    const selectedCustomer = watch("customer")

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

    const {setFormRef, next} = useEnterNavigation({
        fields: ["serial", "loan_no", "customer_picker", "metal_type", "product", "quality", "seal"],
        onSubmit: handleFormSubmit,
    });

    return <form ref={setFormRef} className="p-4">
        {/*<pre><code>{JSON.stringify(values, null, 2)}</code></pre>*/}
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
                        <SelectTrigger name="metal_type">
                            <SelectValue placeholder="Meta Type"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Gold">Gold</SelectItem>
                            <SelectItem value="Silver">Silver</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            />
            <div className="flex w-[800px] input-matrix flex-col">
                <div className="flex">
                    <Controller
                        name="product"
                        control={control}
                        render={({field}) => (
                            <ProductSelector
                                onChange={field.onChange}
                                productType="product"
                                metalType="Gold"
                                inputName="product"
                                placeholder="Product"
                                triggerWidth="w-[250px]"
                            />
                        )}
                    />

                    <ProductSelector
                        productType="quality"
                        metalType="Other"
                        inputName="quality"
                        placeholder="Quality"
                        triggerWidth="w-[250px]"
                    />
                    <ProductSelector
                        productType="seal"
                        metalType="Other"
                        inputName="seal"
                        placeholder="Seal"
                        triggerWidth="w-[150px]"
                    />
                </div>
            </div>
            {/*{renderField('', 'Name', (field, invalid) => (*/}
            {/*    <Input {...field} id="name" name="name" aria-invalid={invalid} autoFocus autoComplete="off"/>*/}
            {/*))}*/}
        </FieldGroup>
    </form>;
}