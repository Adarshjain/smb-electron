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
import { create, read, update } from '@/hooks/dbUtil.ts';
import { errorToast } from '@/lib/myUtils.tsx';
import ProductSelector from '@/components/ProductSelector.tsx';
import { Input } from '@/components/ui/input';
import type { Tables } from '../../tables';
import AreaSelector from '@/components/AreaSelector.tsx';
import { toast } from 'sonner';
import { toastStyles } from '@/constants/loanForm.ts';
import { Button } from '@/components/ui/button';
import CustomerPicker from '@/components/CustomerPicker.tsx';
import { Label } from '@/components/ui/label';
import GoHome from '@/components/GoHome.tsx';

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

export default function CustomerCrud({
  cantEdit,
  onCreate,
}: {
  cantEdit?: boolean;
  onCreate?: (customer: Tables['customers']) => void;
}) {
  const [areasList, setAreasList] = useState<Tables['areas'][]>([]);
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
  const id = watch('id');

  const onCustomerSelect = async (customer: Tables['customers']) => {
    try {
      const areasResponse = await read('areas', { name: customer.area });
      if (!areasResponse?.length) {
        toast.error('Area does not exist', {
          className: toastStyles.error,
        });
        return;
      }
      reset({
        id: customer.id,
        address1: customer.address1 ?? '',
        address2: customer.address2 ?? '',
        door_no: customer.door_no ?? '',
        fhname: customer.fhname,
        area: areasResponse[0],
        fhtitle: customer.fhtitle,
        id_proof: customer.id_proof ?? '',
        id_proof_value: customer.id_proof_value ?? '',
        name: customer.name,
        phone_no: customer.phone_no ?? '',
      });
    } catch (error) {
      errorToast(error);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        const customerResponse = await read('customers', {});
        if (customerResponse?.length) {
          const addressSet = new Set<string>();
          const nameSet = new Set<string>();
          for (const r of customerResponse) {
            nameSet.add(r.name.trim());
            nameSet.add(r.fhname.trim());
            if (r.address1) addressSet.add(r.address1.trim());
            if (r.address2) addressSet.add(r.address2.trim());
          }
          setAddressList([...addressSet].sort());
          setNameList([...nameSet].sort());
        }
        const areaResponse = await read('areas', {});
        if (areaResponse?.length) {
          setAreasList(areaResponse);
        }
      } catch (e) {
        errorToast(e);
      }
    };
    void run();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function onSubmit(data: Customer) {
    const customer: Tables['customers'] = {
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
    };
    if (id) {
      try {
        await update('customers', {
          ...customer,
          id,
        });
      } catch (error) {
        errorToast(error);
      }
    } else {
      try {
        await create('customers', customer);
      } catch (error) {
        errorToast(error);
      }
      onCreate?.(customer);
    }
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
    <form ref={setFormRef} className="flex gap-3 flex-col p-2 w-[465px]">
      <div className="flex gap-6">
        <GoHome />
        <div className="text-xl text-center">
          {id ? 'Editing Customer' : 'New Customer'}
        </div>
      </div>
      {!cantEdit ? (
        <CustomerPicker
          inputClassName="w-[370px]"
          placeholder="Search Customer"
          onSelect={(customer: Tables['customers']) =>
            void onCustomerSelect(customer)
          }
        />
      ) : null}
      <div className="flex gap-2">
        <Label className="w-[70px]">Name</Label>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <ProductSelector
              {...field}
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
      </div>
      <div className="flex gap-2">
        <Label className="w-[70px]">F/H Name</Label>
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
                <SelectValue />
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
              {...field}
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
        <Label className="w-[70px]">Address 1</Label>
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
              {...field}
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
      <div className="flex gap-2">
        <Label className="w-[70px]">Address 2</Label>
        <Controller
          name="address2"
          control={control}
          render={({ field }) => (
            <ProductSelector
              {...field}
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
      </div>
      <div className="flex gap-2">
        <Label className="w-[70px]">Area</Label>
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
      </div>
      {area.name && (
        <div>
          <Label className="w-[70px]">Area Details: </Label>
          {area.post ? `Post: ${area.post}` : ''} {area.town} {area.pincode}
        </div>
      )}
      <div className="flex gap-2">
        <Label className="w-[70px]">Phone</Label>
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
      </div>
      <div className="flex gap-2">
        <Label className="w-[70px]">ID Proof</Label>
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
      </div>
      <div className="flex gap-2">
        <Label className="w-[70px]">ID Proof Value</Label>
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
      </div>
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
