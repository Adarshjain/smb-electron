import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import * as z from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEnterNavigation } from '@/hooks/useEnterNavigation.ts';
import { useCallback, useEffect, useState } from 'react';
import { create, read } from '@/hooks/dbUtil.ts';
import { toastElectronResponse } from '@/lib/myUtils.tsx';
import ProductSelector from '@/components/ProductSelector.tsx';
import { Input } from '@/components/ui/input';
import type { Tables } from '../../tables';
import AreaSelector from '@/components/AreaSelector.tsx';
import { toast } from 'sonner';
import { toastStyles } from '@/constants/loanForm.ts';
import { Button } from '@/components/ui/button';

const CustomerSchema = z.object({
  id: z.string(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  area: z.object({
    name: z.string().min(1, 'Missing'),
    town: z.string().nullable().optional(),
    post: z.string().nullable().optional(),
    pincode: z.string().nullable().optional(),
  }),
  phone_no: z.string().optional(),
  fhtitle: z.string().min(1, 'Missing'),
  name: z.string().min(1, 'Missing'),
  fhname: z.string().min(1, 'Missing'),
  id_proof: z.string().optional(),
  id_proof_value: z.string().optional(),
  door_no: z.string().optional(),
});

type Customer = z.infer<typeof CustomerSchema>;

export default function CustomerCrud() {
  const [areasList, setAreasList] = useState<Tables['areas']['Row'][]>([]);
  const [addressList, setAddressList] = useState<string[]>([]);
  const [nameList, setNameList] = useState<string[]>([]);
  const defaultValues: Customer = {
    id: '',
    address1: '',
    address2: '',
    door_no: '',
    fhname: '',
    area: {
      name: '',
    },
    fhtitle: 'S/O',
    id_proof: '',
    id_proof_value: '',
    name: '',
    phone_no: '',
  };

  const { control, watch, handleSubmit, reset } = useForm<Customer>({
    resolver: zodResolver(CustomerSchema),
    defaultValues,
  });

  const area = watch('area');

  useEffect(() => {
    const run = async () => {
      const customerResponse = await read('customers', {});
      if (!customerResponse.success) {
        toastElectronResponse(customerResponse);
        return;
      }
      if (customerResponse.data?.length) {
        const addressSet = new Set<string>();
        const nameSet = new Set<string>();
        for (const r of customerResponse.data) {
          nameSet.add(r.name.trim());
          nameSet.add(r.fhname.trim());
          if (r.address1) addressSet.add(r.address1.trim());
          if (r.address2) addressSet.add(r.address2.trim());
        }
        setAddressList([...addressSet].sort());
        setNameList([...nameSet].sort());
      }
      const areaResponse = await read('areas', {});
      if (areaResponse.success && areaResponse.data?.length) {
        setAreasList(areaResponse.data);
      }
    };
    void run();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function onSubmit(data: Customer) {
    const resp = await create('customers', {
      id: `${data.name.substring(0, 3)}${data.fhname.substring(0, 3)}${data.area.name.substring(0, 3)}`,
      name: data.name,
      fhtitle: data.fhtitle,
      fhname: data.fhname,
      area: data.area.name,
      address1: data.address1 ?? null,
      phone_no: data.phone_no === '' ? null : (data.phone_no ?? null),
      door_no: data.door_no === '' ? null : (data.door_no ?? null),
      id_proof: data.id_proof === '' ? null : (data.id_proof ?? null),
      id_proof_value:
        data.id_proof_value === '' ? null : (data.id_proof_value ?? null),
      address2: data.address2 === '' ? null : (data.address2 ?? null),
    });
    toastElectronResponse(resp);
    reset(defaultValues);
  }

  const handleFormSubmit = useCallback(() => {
    void handleSubmit(onSubmit, (obj) => {
      toast.error('Some Fields are missing:' + Object.keys(obj).join(', '), {
        className: toastStyles.error,
      });
    })();
  }, [handleSubmit, onSubmit]);

  const { setFormRef, next } = useEnterNavigation<keyof Customer>({
    fields: [
      'name',
      'fhtitle',
      'fhname',
      'door_no',
      'address1',
      'address2',
      'area',
      'phone_no',
      'id_proof',
      'id_proof_value',
    ],
    onSubmit: handleFormSubmit,
  });

  return (
    <form ref={setFormRef} className="flex gap-3 flex-col p-4 w-[400px]">
      <div>Customer</div>
      <Controller
        name="name"
        control={control}
        render={({ field }) => (
          <ProductSelector
            value={field.value}
            onChange={field.onChange}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            options={nameList}
            inputName="name"
            placeholder="Name"
            triggerWidth="w-[370px]"
            popoverWidth="w-[370px]"
            autoFocus
          />
        )}
      />
      <div className="flex gap-2">
        <Controller
          name="fhtitle"
          control={control}
          render={({ field }) => (
            <Select
              onValueChange={(value: string) => {
                field.onChange(value);
                setTimeout(next, 100);
              }}
              value={field.value}
            >
              <SelectTrigger className="w-20" name="fhtitle">
                <SelectValue placeholder="S/F/W/C/O" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="S/O">S/O</SelectItem>
                <SelectItem value="W/O">W/O</SelectItem>
                <SelectItem value="D/O">D/O</SelectItem>
                <SelectItem value="C/O">C/O</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        <Controller
          name="fhname"
          control={control}
          render={({ field }) => (
            <ProductSelector
              value={field.value}
              onChange={field.onChange}
              onFocus={(e) => {
                e.currentTarget.select();
              }}
              options={nameList}
              inputName="fhname"
              placeholder="Father/Husband Name"
              triggerWidth="w-[280px]"
              popoverWidth="w-[280px]"
            />
          )}
        />
      </div>
      <div className="flex gap-2">
        <Controller
          name="door_no"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              onFocus={(e) => {
                e.currentTarget.select();
              }}
              id="door_no"
              name="door_no"
              placeholder="Door No"
              className="w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          )}
        />
        <Controller
          name="address1"
          control={control}
          render={({ field }) => (
            <ProductSelector
              value={field.value}
              onChange={field.onChange}
              onFocus={(e) => {
                e.currentTarget.select();
              }}
              options={addressList}
              inputName="address1"
              placeholder="Address Line 1"
              triggerWidth="w-[280px]"
              popoverWidth="w-[280px]"
            />
          )}
        />
      </div>
      <Controller
        name="address2"
        control={control}
        render={({ field }) => (
          <ProductSelector
            value={field.value}
            onChange={field.onChange}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            options={addressList}
            inputName="address2"
            placeholder="Address Line 2"
            triggerWidth="w-[370px]"
            popoverWidth="w-[370px]"
          />
        )}
      />
      <Controller
        name="area"
        control={control}
        render={({ field }) => (
          <AreaSelector
            value={areasList.find((area) => area.name === field.value.name)}
            onChange={field.onChange}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            options={areasList}
            inputName="area"
            placeholder="Area"
            triggerWidth="w-[370px]"
          />
        )}
      />
      {area && (
        <div>
          {area.post ? `Post: ${area.post}` : ''} {area.town} {area.pincode}
        </div>
      )}
      <Controller
        name="phone_no"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            id="phone_no"
            name="phone_no"
            placeholder="Phone"
            className="w-[370px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        )}
      />
      <Controller
        name="id_proof"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            id="id_proof"
            name="id_proof"
            placeholder="ID Proof Type"
            className="w-[370px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        )}
      />
      <Controller
        name="id_proof_value"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            id="id_proof_value"
            name="id_proof_value"
            placeholder="ID Proof Value"
            className="w-[370px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        )}
      />
      <Button
        onClick={(e) => {
          e.preventDefault();
          handleFormSubmit();
        }}
      >
        Save
      </Button>
    </form>
  );
}
