import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/DatePicker.tsx';
import { Checkbox } from '@/components/ui/checkbox';
import type { Tables } from '@/../tables';
import { toast } from 'sonner';
import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Controller,
  type ControllerRenderProps,
  useForm,
} from 'react-hook-form';
import * as z from 'zod';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field';
import { format } from 'date-fns';
import { useEnterNavigation } from '@/hooks/useEnterNavigation.ts';
import { create, update } from '@/hooks/dbUtil.ts';
import { errorToast, successToast } from '@/lib/myUtils.tsx';
import { toastStyles } from '@/constants/loanForm.ts';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  current_date: z.string(),
  next_serial_letter: z
    .string()
    .regex(/^[A-Za-z]$/, 'Must be a single letter A-Z'),
  next_serial_number: z.number().min(1).max(10000),
  is_default: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export interface CrudCompanyProps {
  company?: LocalTables<'companies'>;
  label?: JSX.Element;
  onSave?: () => void;
}

export function CrudCompany({ company, label, onSave }: CrudCompanyProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isCreate = !company;

  const defaultValues = useMemo(
    () => ({
      name: '',
      current_date: format(new Date(), 'yyyy-MM-dd'),
      is_default: false,
      next_serial_letter: 'A',
      next_serial_number: 1,
    }),
    []
  );

  const { control, handleSubmit, reset } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    if (company) {
      const [letter, number] = company.next_serial.split('-');
      reset({
        name: company.name,
        current_date: company.current_date,
        is_default: company.is_default === 1,
        next_serial_letter: letter,
        next_serial_number: parseInt(number),
      });
    }
  }, [company, reset]);

  const onSubmit = useCallback(
    async (data: FormData) => {
      const toastId = toast.loading(
        isCreate ? 'Creating company...' : 'Saving changes...'
      );
      try {
        const payload: Partial<LocalTables<'companies'>> = {
          name: data.name,
          current_date: data.current_date,
          next_serial: `${data.next_serial_letter.toUpperCase()}-${data.next_serial_number}`,
          is_default: data.is_default ? 1 : 0,
        };

        if (data.is_default) {
          await window.api.db.query(
            'UPDATE companies SET is_default = 0',
            undefined,
            true
          );
        }

        try {
          await (isCreate
            ? create('companies', payload)
            : update('companies', payload));
          successToast('Success');
        } catch (e) {
          errorToast(e);
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'An unknown error occurred',
          { className: toastStyles.error }
        );
      } finally {
        toast.dismiss(toastId);
        onSave?.();
        setIsModalOpen(false);
      }
    },
    [isCreate, onSave]
  );

  const handleFormSubmit = useCallback(() => {
    void handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  const { setFormRef } = useEnterNavigation({
    fields: [
      'name',
      'current_date',
      'next_serial_letter',
      'next_serial_number',
    ],
    onSubmit: handleFormSubmit,
  });

  const renderField = useCallback(
    <K extends keyof FormData>(
      name: K,
      label: string,
      render: (
        field: ControllerRenderProps<FormData, K>,
        invalid: boolean
      ) => JSX.Element
    ) => (
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-1">
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            {render(field, fieldState.invalid)}
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    ),
    [control]
  );

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        {label ?? (
          <Button variant="outline">
            {isCreate ? 'Create Company' : 'Edit Company'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[450px]"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {isCreate ? 'Create Company' : 'Edit Company'}
          </DialogTitle>
        </DialogHeader>
        <form ref={setFormRef}>
          <FieldGroup className="gap-3">
            {renderField('name', 'Name', (field, invalid) => (
              <Input
                {...field}
                id="name"
                name="name"
                aria-invalid={invalid}
                autoFocus
                autoComplete="off"
              />
            ))}

            {renderField('current_date', 'Current Date', (field, invalid) => (
              <DatePicker
                {...field}
                value={field.value}
                id="current_date"
                name="current_date"
                isError={invalid}
              />
            ))}

            <Field className="gap-1">
              <FieldLabel>Next Loan</FieldLabel>
              <div className="flex">
                <Controller
                  name="next_serial_letter"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      id="next_serial_letter"
                      name="next_serial_letter"
                      maxLength={1}
                      placeholder="A"
                      aria-invalid={fieldState.invalid}
                      className="w-14 rounded-r-none text-center uppercase focus-visible:z-10"
                    />
                  )}
                />
                <Controller
                  name="next_serial_number"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Input
                      {...field}
                      id="next_serial_number"
                      name="next_serial_number"
                      type="number"
                      placeholder="1"
                      aria-invalid={fieldState.invalid}
                      className="w-24 rounded-l-none border-l-0 text-center focus-visible:z-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d{0,5}$/.test(val)) {
                          field.onChange(val ? parseInt(val) : '');
                        }
                      }}
                    />
                  )}
                />
              </div>
            </Field>

            <Controller
              name="is_default"
              control={control}
              render={({ field }) => (
                <FieldSet>
                  <FieldGroup data-slot="checkbox-group">
                    <Field
                      orientation="horizontal"
                      className="flex items-start"
                    >
                      <Checkbox
                        id="is_default"
                        disabled={!!company?.is_default}
                        name={field.name}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      <div className="grid">
                        <FieldLabel htmlFor="is_default">Default</FieldLabel>
                        <p className="text-muted-foreground text-sm">
                          This company will be selected by default when app
                          launches
                        </p>
                      </div>
                    </Field>
                  </FieldGroup>
                </FieldSet>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleFormSubmit}>
              {isCreate ? 'Create Company' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
