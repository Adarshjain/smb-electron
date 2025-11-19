import {
  currentIsoDate,
  isValidIsoDate,
  nextIsoDate,
  previousIsoDate,
} from '@/lib/myUtils.tsx';
import { useState } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { useCompany } from '@/context/CompanyProvider.tsx';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog.tsx';
import { Button } from '@/components/ui/button.tsx';
import DatePicker from '@/components/DatePicker.tsx';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function CurrentDateCrud() {
  const { company, setCurrentDate } = useCompany();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [internalDate, setInternalDate] = useState<string>(
    nextIsoDate(company?.current_date ?? currentIsoDate())
  );

  const onSet = (e?: React.MouseEvent) => {
    if (!isValidIsoDate(internalDate)) {
      e?.preventDefault();
      return;
    }
    void setCurrentDate(internalDate);
    setIsModalOpen(false);
  };

  if (!company) {
    return null;
  }
  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <Button
        asChild
        variant="outline"
        className="w-full grid grid-cols-[1fr_auto_1fr] px-3 border-input font-normal"
        id="change-date-button"
      >
        <DialogTrigger>
          <Kbd className="justify-self-start col-start-1">F7</Kbd>
          <div className="justify-self-center col-start-2">Change Date</div>
        </DialogTrigger>
      </Button>
      <DialogContent
        className="sm:max-w-[450px]"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Change Current Date</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <DatePicker
            value={internalDate}
            onInputChange={setInternalDate}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSet();
              }
            }}
          />
          <DialogClose asChild>
            <Button onClick={onSet} variant="outline">
              Set
            </Button>
          </DialogClose>
        </div>
        <DialogClose asChild>
          <div className="flex gap-2 justify-between">
            <Button
              onClick={() =>
                void setCurrentDate(previousIsoDate(company?.current_date))
              }
              variant="outline"
            >
              <ArrowLeft /> Previous Date
            </Button>
            <Button variant="link">Cancel</Button>
            <Button
              onClick={() =>
                void setCurrentDate(nextIsoDate(company?.current_date))
              }
            >
              Next Date
              <ArrowRight />
            </Button>
          </div>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
