import { useEffect } from 'react';
import { useEnterNavigation } from '@/hooks/useEnterNavigation.ts';
import { useTabs } from '@/TabManager.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Input } from '@/components/ui/input.tsx';
import { create } from '@/hooks/dbUtil.ts';
import { errorToast, successToast } from '@/lib/myUtils.tsx';
import { Button } from '@/components/ui/button.tsx';

export default function AreaCrud() {
  const { closeTab } = useTabs();

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

  const { setFormRef, formRef } = useEnterNavigation({
    fields: ['name', 'town', 'post', 'pincode'],
    onSubmit: handleFormSubmit,
  });

  function handleFormSubmit() {
    if (!formRef.current) return;

    const run = async () => {
      try {
        const formData = new FormData(formRef.current as HTMLFormElement);

        const data = Object.fromEntries(formData.entries()) as {
          name: string;
          town: string;
          post: string;
          pincode: string;
        };
        if (!data.name) {
          errorToast('Name is empty!');
          return;
        }

        await create('areas', {
          name: data.name,
          post: data.post,
          town: data.town,
          pincode: data.pincode,
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
        <Label className="w-[70px]">Name</Label>
        <Input
          onFocus={(e) => {
            e.currentTarget.select();
          }}
          name="name"
          placeholder="Area Name"
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
          placeholder="Town"
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
          placeholder="Post"
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
