import CompanySelector from '@/components/CompanySelector.tsx';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.tsx';
import { useEffect } from 'react';
import { Kbd } from '@/components/ui/kbd';
import QuickView from '@/components/QuickView.tsx';

const shortCutMapping: {
  shortcutKey: string;
  url: string;
}[] = [
  {
    shortcutKey: 'F2',
    url: '/new-loan',
  },
  {
    shortcutKey: 'F3',
    url: '/release-loan',
  },
  {
    shortcutKey: 'F8',
    url: '/day-book',
  },
];

export function Home() {
  const navigate = useNavigate();
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        const companySwitcher = document.getElementsByName('company-switcher');
        if (companySwitcher.length) {
          companySwitcher[0].click();
        }
      } else if (e.key === 'F6') {
        const customerPicker = document.getElementsByName('customer_picker');
        if (customerPicker.length) {
          customerPicker[0].focus();
        }
      }
      const match = shortCutMapping.find((sc) => sc.shortcutKey === e.key);
      if (match) {
        void navigate(match.url);
      }
    };

    window.addEventListener('keydown', listener);

    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, [navigate]);

  return (
    <div className="flex">
      <div className="flex-1 p-4">
        <QuickView />
      </div>
      <div className="flex flex-col gap-3 p-6 w-[300px]">
        <CompanySelector />
        <Button
          variant="outline"
          className="w-full grid grid-cols-[1fr_auto_1fr] px-3 border-input font-normal"
          onClick={() => void navigate('/new-loan')}
        >
          <Kbd className="justify-self-start col-start-1">F2</Kbd>
          <div className="justify-self-center col-start-2">New Loan</div>
        </Button>
        <Button
          variant="outline"
          className="w-full grid grid-cols-[1fr_auto_1fr] px-3 border-input font-normal"
          onClick={() => void navigate('/release-loan')}
        >
          <Kbd className="justify-self-start col-start-1">F3</Kbd>
          <div className="justify-self-center col-start-2">Release Loan</div>
        </Button>
        <Button
          variant="outline"
          className="w-full grid grid-cols-[1fr_auto_1fr] px-3 border-input font-normal"
          onClick={() => void navigate('/day-book')}
        >
          <Kbd className="justify-self-start col-start-1">F8</Kbd>
          <div className="justify-self-center col-start-2">Day Book</div>
        </Button>
        <Button
          variant="outline"
          className="w-full grid grid-cols-[1fr_auto_1fr] px-3 border-input font-normal"
          onClick={() => void navigate('/customer-crud')}
        >
          <div className="justify-self-center col-start-2">Customer CRUD</div>
        </Button>
      </div>
    </div>
  );
}
