import { useCompany } from '@/context/CompanyProvider.tsx';
import z from 'zod';
import type { LocalTables, Tables } from '../../tables';
import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Controller,
  type ControllerRenderProps,
  useForm,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  errorToast,
  formatCurrency,
  jsNumberFix,
  successToast,
} from '@/lib/myUtils.tsx';
import { useEnterNavigation } from '@/hooks/useEnterNavigation.ts';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { create, query, update } from '@/hooks/dbUtil.ts';

const accountHeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  opening_balance: z.string(),
  hisaab_group: z.string(),
});

type AccountHeadForm = z.infer<typeof accountHeadSchema>;

interface AccountHeadCrudProps {
  accountHead?: LocalTables<'account_head'>;
  label?: JSX.Element;
  onSave?: () => void;
}

const ACCOUNT_HEADS = [
  'Expenses',
  'Income',
  'Loans & Advances',
  'Income (indirect)',
  'Cash Transaction',
  'Fixed Assets',
  'Sundry Debtors',
  'Capital Account',
  'Bank Account',
  'Sundry Creditors',
  'Advance Income Tax',
  'Bank OD A/c',
  'Deposits & Advances',
  'Current Liabilities',
];

export default function AccountHeadCrud({
  accountHead,
  label,
  onSave,
}: AccountHeadCrudProps) {
  const { company } = useCompany();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isCreate = !accountHead;

  const defaultValues = useMemo(
    () => ({
      name: '',
      opening_balance: '0.00',
      hisaab_group: 'Expenses',
    }),
    []
  );

  const { control, handleSubmit, reset } = useForm<AccountHeadForm>({
    resolver: zodResolver(accountHeadSchema),
    defaultValues,
  });

  useEffect(() => {
    if (accountHead) {
      reset({
        name: accountHead.name,
        opening_balance: formatCurrency(accountHead.opening_balance, true),
        hisaab_group: accountHead.hisaab_group,
      });
    }
  }, [accountHead, reset]);

  const onSubmit = useCallback(
    async (data: AccountHeadForm) => {
      try {
        let code: number;
        if (isCreate) {
          const latestCodeResponse = await query<[{ code: number }]>(
            `SELECT code
             FROM account_head
             WHERE company = ?
               AND deleted IS NULL
             ORDER BY code DESC
             LIMIT 1`,
            [company?.name]
          );
          code = (latestCodeResponse?.[0].code ?? 0) + 1;
        } else {
          code = accountHead?.code ?? 0;
        }

        const payload: Tables['account_head'] = {
          code,
          company: company?.name ?? '',
          name: data.name,
          opening_balance: jsNumberFix(parseFloat(data.opening_balance || '0')),
          hisaab_group: data.hisaab_group,
        };

        await (isCreate
          ? create('account_head', payload)
          : update('account_head', payload));
        onSave?.();
        successToast('Success');
      } catch (e) {
        errorToast(e);
      } finally {
        setIsModalOpen(false);
      }
    },
    [accountHead?.code, company?.name, isCreate, onSave]
  );
  const handleFormSubmit = useCallback(() => {
    void handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  const { setFormRef } = useEnterNavigation({
    fields: ['name', 'opening_balance', 'hisaab_group'],
    onSubmit: handleFormSubmit,
  });

  const renderField = useCallback(
    <K extends keyof AccountHeadForm>(
      name: K,
      label: string,
      render: (
        field: ControllerRenderProps<AccountHeadForm, K>,
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
          <Button variant="outline" className="ml-auto my-2 h-8">
            {isCreate ? 'Create Account Head' : 'Edit Account Head'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[450px]"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {isCreate ? 'Create Account Head' : 'Edit Account Head'}
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
                onFocus={(e) => {
                  e.currentTarget.select();
                }}
                autoComplete="off"
              />
            ))}

            {renderField(
              'opening_balance',
              'Opening Balance',
              (field, invalid) => (
                <Input
                  {...field}
                  id="opening_balance"
                  name="opening_balance"
                  onFocus={(e) => {
                    e.currentTarget.select();
                  }}
                  aria-invalid={invalid}
                  autoComplete="off"
                />
              )
            )}
            {renderField('hisaab_group', 'Group', (field, invalid) => (
              <NativeSelect
                {...field}
                id="hisaab_group"
                name="hisaab_group"
                aria-invalid={invalid}
                autoComplete="off"
              >
                {ACCOUNT_HEADS.map((head) => (
                  <NativeSelectOption key={head} value={head}>
                    {head}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ))}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleFormSubmit} className="flex-2">
              {isCreate ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
