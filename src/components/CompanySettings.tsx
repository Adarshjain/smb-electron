import {Button} from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import DatePicker from "@/components/DatePicker.tsx";
import {Checkbox} from "@/components/ui/checkbox"
import type {Tables} from "../../tables";
import {toast} from "sonner";
import {useEffect, useState} from "react";
import {zodResolver} from "@hookform/resolvers/zod"
import {Controller, useForm} from "react-hook-form"
import * as z from "zod"
import {Field, FieldError, FieldGroup, FieldLabel, FieldSet,} from "@/components/ui/field"
import {format} from "date-fns";
import {useEnterNavigation} from "@/hooks/useEnterNavigation.ts";
import {getDBMethods} from "@/hooks/dbUtil.ts";

const formSchema = z.object({
    "name": z.string().min(1, 'Name is required'),
    "current_date": z.string(),
    "next_serial_letter": z.string().regex(/^[A-Za-z]$/, 'Must be a single letter A-Z'),
    "next_serial_number": z.number().min(1).max(10000),
    "is_default": z.boolean(),
})

export function CompanySettings(props: {
    company?: Tables['companies']['Row']
    label?: string
}) {
    const [isCreate, setIsCreate] = useState(props.company === undefined);

    useEffect(() => {
        setIsCreate(props.company === undefined);
    }, [props.company]);

    const {
        control,
        handleSubmit,
        reset,
    } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            current_date: format(new Date(), 'yyyy-MM-dd'),
            is_default: false,
            next_serial_letter: 'A',
            next_serial_number: 1,
        },
    })

    useEffect(() => {
        if (props.company) {
            const [letter, number] = props.company.next_serial.split('-');
            reset({
                name: props.company.name,
                current_date: props.company.current_date,
                is_default: props.company.is_default === 1,
                next_serial_letter: letter,
                next_serial_number: parseInt(number),
            });
        }
    }, [props.company, reset]);

    const formRef = useEnterNavigation({
        fields: ["name", "current_date", "next_serial_letter", "next_serial_number"],
        onSubmit: () => handleSubmit(onSubmit)(),
    });

    async function onSubmit(data: z.infer<typeof formSchema>) {
        const toastId = toast.loading(isCreate ? 'Creating company...' : 'Saving changes...');
        try {
            const {create, update} = getDBMethods('companies');
            const payLoad: Tables['companies']['Insert'] | Tables['companies']['Update'] = {
                name: data.name,
                current_date: data.current_date,
                next_serial: data.next_serial_letter.toUpperCase() + '-' + data.next_serial_number,
                is_default: data.is_default ? 1 : 0,
            };

            const response = await (isCreate ? create(payLoad as Tables['companies']['Insert']) : update(payLoad as Tables['companies']['Update']));
            if (!response.success) {
                if (response.error === 'UNIQUE constraint failed: companies.name') {
                    toast.error(`${data.name} already exists.`);
                    return;
                }
                toast.error(`Error: ${response.error}`, {
                    description: (
                        <pre className="bg-code text-code-foreground mt-2 w-[320px] overflow-x-auto rounded-md p-4">
                            <code>{response.stack}</code>
                        </pre>
                    ),
                    classNames: {
                        content: "flex flex-col gap-2",
                    },
                    style: {
                        "--border-radius": "calc(var(--radius)  + 4px)",
                    } as React.CSSProperties,
                })
            } else {
                toast.success(isCreate ? `Created company "${data.name}"` : `Saved changes to "${data.name}"`)
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'An unknown error occurred');
        } finally {
            toast.dismiss(toastId);
        }
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">{props.label || isCreate ? 'Create Company' : `Edit Company`}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>{isCreate ? 'Create Company' : `Edit Company`}</DialogTitle>
                </DialogHeader>
                <form ref={formRef}>
                    <FieldGroup className="gap-3">
                        <Controller
                            name="name"
                            control={control}
                            render={({field, fieldState}) => (
                                <Field data-invalid={fieldState.invalid} className="gap-1">
                                    <FieldLabel htmlFor="company-name">Name</FieldLabel>
                                    <Input
                                        {...field}
                                        aria-invalid={fieldState.invalid}
                                        id="company-name"
                                        name="name"
                                        autoFocus
                                        autoComplete="off"
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]}/>
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="current_date"
                            control={control}
                            render={({field, fieldState}) => (
                                <Field data-invalid={fieldState.invalid} className="gap-1">
                                    <FieldLabel htmlFor="current_date">Current Date</FieldLabel>
                                    <DatePicker
                                        {...field}
                                        id="current_date"
                                        name="current_date"
                                        isError={fieldState.invalid}
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]}/>
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="next_serial_letter"
                            control={control}
                            render={({field: letterField, fieldState: letterState}) => (
                                <Controller
                                    name="next_serial_number"
                                    control={control}
                                    render={({field: numberField, fieldState: numberState}) => (
                                        <Field
                                            data-invalid={letterState.invalid || numberState.invalid}
                                            className="flex flex-col gap-1"
                                        >
                                            <FieldLabel>Next Loan</FieldLabel>
                                            <div className="flex items-center">
                                                {/* Letter Input */}
                                                <Input
                                                    {...letterField}
                                                    id="next_serial_letter"
                                                    name="next_serial_letter"
                                                    maxLength={1}
                                                    placeholder="A"
                                                    className={`w-14 rounded-r-none text-center uppercase focus-visible:z-10`}
                                                />

                                                {/* Number Input */}
                                                <Input
                                                    {...numberField}
                                                    id="next_serial_number"
                                                    name="next_serial_number"
                                                    type="number"
                                                    placeholder="1"
                                                    className={`w-24 rounded-l-none border-l-0 text-center focus-visible:z-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (/^\d{0,5}$/.test(val)) numberField.onChange(val ? parseInt(val) : "");
                                                    }}
                                                />
                                            </div>

                                            {/* Error Message */}
                                            {(letterState.invalid || numberState.invalid) && (
                                                <FieldError
                                                    errors={[letterState.error, numberState.error].filter(Boolean)}
                                                />
                                            )}
                                        </Field>
                                    )}
                                />
                            )}
                        />
                        <Controller
                            name="is_default"
                            control={control}
                            render={({field, fieldState}) => (
                                <FieldSet data-invalid={fieldState.invalid}>
                                    <FieldGroup data-slot="checkbox-group">
                                        <Field orientation="horizontal" className="flex items-start">
                                            <Checkbox
                                                id="is_default"
                                                name={field.name}
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                            <div className="grid">
                                                <FieldLabel htmlFor="is_default">Default</FieldLabel>
                                                <p className="text-muted-foreground text-sm">
                                                    This company will be selected by default when app launches
                                                </p>
                                            </div>
                                        </Field>
                                    </FieldGroup>
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]}/>
                                    )}
                                </FieldSet>
                            )}
                        />
                    </FieldGroup>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="button" onClick={() => {
                            handleSubmit(onSubmit)()
                        }}>{isCreate ? 'Create Company' : 'Save Changes'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
