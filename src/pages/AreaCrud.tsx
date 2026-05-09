import { useEffect, useState } from 'react';
import { useEnterNavigation } from '@/hooks/useEnterNavigation.ts';
import { useTabs } from '@/TabManager.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Input } from '@/components/ui/input.tsx';
import { create } from '@/hooks/dbUtil.ts';
import { errorToast, successToast } from '@/lib/myUtils.tsx';
import { Button } from '@/components/ui/button.tsx';
import { useThanglish } from '@/context/ThanglishProvider.tsx';

export default function AreaCrud() {
  const { closeTab } = useTabs();
  const { convert } = useThanglish();
  const [name, setName] = useState('');
  const [town, setTown] = useState('');
  const [post, setPost] = useState('');
  const [pincode, setPincode] = useState('');

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'F6') {
        closeTab();
      }
    };

    window.addEventListener('keydown', listener);

    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, [closeTab]);

  const { setFormRef } = useEnterNavigation({
    fields: ['name', 'town', 'post', 'pincode'],
    onSubmit: handleFormSubmit,
  });

  function handleFormSubmit() {
    const run = async () => {
      try {
        if (!name) {
          errorToast('Name is empty!');
          return;
        }

        await create('areas', {
          name,
          post,
          town,
          pincode,
        });
        successToast('Area Created');
      } catch (e) {
        errorToast(e);
      }
    };
    void run();
  }

  return (
    <form ref={setFormRef} className="flex gap-3 flex-col p-2 w-[465px] ml-12">
      <div className="text-xl text-center">Area</div>
      <div className="flex gap-2">
        <Label className="w-[70px]">Name*</Label>
        <Input
          onFocus={(e) => {
            e.currentTarget.select();
          }}
          name="name"
          value={name}
          onChange={(e) => setName(convert(e.target.value))}
          placeholder="Area Name"
          className="w-[370px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <div className="flex gap-2">
        <Label className="w-[70px]">Post</Label>
        <Input
          onFocus={(e) => {
            e.currentTarget.select();
          }}
          name="post"
          value={post}
          onChange={(e) => setPost(convert(e.target.value))}
          placeholder="Post"
          className="w-[370px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <div className="flex gap-2">
        <Label className="w-[70px]">Town</Label>
        <Input
          onFocus={(e) => {
            e.currentTarget.select();
          }}
          name="town"
          value={town}
          onChange={(e) => setTown(convert(e.target.value))}
          placeholder="Town"
          className="w-[370px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <div className="flex gap-2">
        <Label className="w-[70px]">Pin code</Label>
        <Input
          onFocus={(e) => {
            e.currentTarget.select();
          }}
          name="pincode"
          value={pincode}
          onChange={(e) => setPincode(e.target.value)}
          placeholder="Pin code"
          className="w-[370px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
