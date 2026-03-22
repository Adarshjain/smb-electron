import GoHome from '@/components/GoHome.tsx';
import { Input } from '@/components/ui/input.tsx';
import { useEffect, useState } from 'react';
import { query, read } from '@/hooks/dbUtil.ts';
import { errorToast, successToast } from '@/lib/myUtils.tsx';
import ProductSelector from '@/components/ProductSelector.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Button } from '@/components/ui/button.tsx';
import { useThanglish } from '@/context/ThanglishProvider.tsx';

export default function NameCorrector() {
  const { convert } = useThanglish();
  const [nameList, setNameList] = useState<string[]>([]);
  const [oldName, setOldName] = useState('');
  const [newName, setNewName] = useState('');

  const loadNames = async () => {
    try {
      const customerResponse = await read('customers', {});
      if (customerResponse?.length) {
        const nameSet = new Set<string>();
        for (const r of customerResponse) {
          const name = r.name.trim();
          const fhname = r.fhname.trim();
          if (name) nameSet.add(name);
          if (fhname) nameSet.add(fhname);
        }
        setNameList([...nameSet].sort());
      }
    } catch (e) {
      errorToast(e);
    }
  };

  useEffect(() => {
    void loadNames();
  }, []);

  const save = async () => {
    try {
      await query(
        `UPDATE customers
                 SET name   = CASE WHEN name = ? THEN ? ELSE name END,
                     fhname = CASE WHEN fhname = ? THEN ? ELSE fhname END,
                     synced = 0
                 WHERE name = ?
                    OR fhname = ?`,
        [oldName, newName, oldName, newName, oldName, oldName],
        true
      );
      successToast('Updated!');
      setOldName('');
      setNewName('');
      void loadNames();
    } catch (e) {
      errorToast(e);
    }
  };
  return (
    <div className="p-2 w-7/10 mx-auto">
      <div className="flex gap-6 mb-6">
        <GoHome />
        <div className="text-xl text-center">Name Corrector</div>
      </div>
      <div className="flex gap-4">
        <div>
          <Label className="mb-2">Old Name</Label>
          <ProductSelector
            onChange={setOldName}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            options={nameList}
            inputName="name"
            placeholder="Name"
            triggerWidth="w-[355px]"
            popoverWidth="w-[355px]"
            autoFocus
            autoConvert
            allowTempValues
          />
        </div>
        <div>
          <Label className="mb-2">New Name</Label>
          <Input
            className="w-[355px]"
            value={newName}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            onInput={(e) => {
              setNewName(convert(e.currentTarget.value));
            }}
          />
        </div>
      </div>
      <Button
        disabled={oldName === '' || newName === ''}
        className="w-50 mt-4"
        onClick={() => void save()}
      >
        Save
      </Button>
    </div>
  );
}
