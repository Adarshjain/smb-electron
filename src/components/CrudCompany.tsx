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
import type { LocalTables, Tables } from '@/../tables';
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
import { useEnterNavigation } from '@/hooks/useEnterNavigation.ts';
import { create, query, update } from '@/hooks/dbUtil.ts';
import { errorToast, successToast } from '@/lib/myUtils.tsx';

const CompanySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  current_date: z.string(),
  next_serial_letter: z
    .string()
    .regex(/^[A-Za-z]$/, 'Must be a single letter A-Z'),
  next_serial_number: z.number().min(1).max(10000),
  is_default: z.boolean(),
});

type CompanyForm = z.infer<typeof CompanySchema>;

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
      current_date: new Date().toISOString().split('T')[0],
      is_default: false,
      next_serial_letter: 'A',
      next_serial_number: 1,
    }),
    []
  );

  const { control, handleSubmit, reset } = useForm<CompanyForm>({
    resolver: zodResolver(CompanySchema),
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
    async (data: CompanyForm) => {
      const toastId = toast.loading(
        isCreate ? 'Creating company...' : 'Saving changes...'
      );
      try {
        const payload: Tables['companies'] = {
          name: data.name,
          current_date: data.current_date,
          next_serial: `${data.next_serial_letter.toUpperCase()}-${data.next_serial_number}`,
          is_default: data.is_default ? 1 : 0,
        };

        if (data.is_default) {
          await query<null>(
            'UPDATE companies SET is_default = 0, synced = 0 where true',
            undefined,
            true
          );
        }

        try {
          await (isCreate
            ? create('companies', payload)
            : update('companies', payload));
          onSave?.();
          successToast('Success');
        } catch (e) {
          errorToast(e);
        }
      } catch (e) {
        errorToast(e);
      } finally {
        toast.dismiss(toastId);
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
    <K extends keyof CompanyForm>(
      name: K,
      label: string,
      render: (
        field: ControllerRenderProps<CompanyForm, K>,
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
