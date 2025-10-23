import * as z from "zod"
import {useCompany} from "@/context/CompanyProvider.tsx";
import {type JSX, useCallback, useEffect, useMemo} from "react";
import {Controller, type ControllerRenderProps, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field.tsx";
import {useEnterNavigation} from "@/hooks/useEnterNavigation.ts";
import {Input} from "@/components/ui/input.tsx";
import CustomerPicker from "@/components/CustomerPicker.tsx";

const newLoanSchema = z.object({
    serial: z.string().min(1).max(1),
    loan_no: z.number().min(1).max(10000),
    loan_amount: z.number(),
    interest_rate: z.float32(),
    first_month_interest: z.float32(),
    date: z.string(),
    doc_charges: z.float32(),
    customer_id: z.string(),
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
        customer_id: '',
        metal_type: 'Gold',
        company: !company ? '' : company.name,
        released: 0,
    }), [company, loanNo, serial]);

    const {control, handleSubmit, reset} = useForm<Loan>({
        resolver: zodResolver(newLoanSchema),
        defaultValues,
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

    const formRef = useEnterNavigation({
        fields: ["serial", "loan_no", "customer_picker"],
        onSubmit: handleFormSubmit,
    });


    const renderField = useCallback(<K extends keyof Loan>(
        name: K,
        label: string,
        render: (field: ControllerRenderProps<Loan, K>, invalid: boolean) => JSX.Element
    ) => (
        <Controller
            name={name}
            control={control}
            render={({field, fieldState}) => (
                <Field data-invalid={fieldState.invalid} className="gap-1">
                    <FieldLabel htmlFor={name}>{label}</FieldLabel>
                    {render(field, fieldState.invalid)}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]}/>}
                </Field>
            )}
        />
    ), [control]);


    return <form ref={formRef}>
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
            <CustomerPicker onChange={console.log}/>
            {/*{renderField('', 'Name', (field, invalid) => (*/}
            {/*    <Input {...field} id="name" name="name" aria-invalid={invalid} autoFocus autoComplete="off"/>*/}
            {/*))}*/}
        </FieldGroup>
    </form>;
}