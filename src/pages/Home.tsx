import CompanySelector from '@/components/CompanySelector.tsx';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.tsx';
import { useEffect } from 'react';
import { Kbd } from '@/components/ui/kbd';
import QuickView from '@/components/QuickView.tsx';
import { useTabs } from '@/TabManager.tsx';
import DailyEntries from '@/components/DailyEntries.tsx';
import CurrentDateCrud from '@/components/CurrentDateCrud.tsx';
import ProfitAndLoss from '@/components/ProfitAndLoss.tsx';
import BalanceSheet from '@/components/BalanceSheet.tsx';

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
  const { openTab } = useTabs();

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'F1': {
          const companySwitcher =
            document.getElementsByName('company-switcher');
          if (companySwitcher.length) {
            companySwitcher[0].click();
          }
          break;
        }
        case 'F6': {
          const customerPicker = document.getElementsByName('customer_picker');
          if (customerPicker.length) {
            customerPicker[0].focus();
          }
          break;
        }
        case 'F4':
          openTab('Cash Book', <DailyEntries />);
          break;
        case 'F7':
          document.getElementById('change-date-button')?.click();
          break;
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
  }, [navigate, openTab]);

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
          onClick={() => openTab('Cash Book', <DailyEntries />)}
        >
          <Kbd className="justify-self-start col-start-1">F4</Kbd>
          <div className="justify-self-center col-start-2">Cash Book</div>
        </Button>
        <Button
          variant="outline"
          className="w-full px-3 border-input font-normal"
          onClick={() => openTab('Profit & Loss', <ProfitAndLoss />)}
        >
          <div className="justify-self-center col-start-2">P&L</div>
        </Button>
        <Button
          variant="outline"
          className="w-full px-3 border-input font-normal"
          onClick={() => openTab('Balance Sheet', <BalanceSheet />)}
        >
          <div className="justify-self-center col-start-2">Balance Sheet</div>
        </Button>
        <CurrentDateCrud />
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
          onClick={() => void navigate('/settings')}
        >
          <div className="justify-self-center col-start-2">Settings</div>
        </Button>
        <Button
          variant="outline"
          className="w-full grid grid-cols-[1fr_auto_1fr] px-3 border-input font-normal"
          onClick={() => void navigate('/incorrect-customers')}
        >
          <div className="justify-self-center col-start-2">
            Incorrect Customers
          </div>
        </Button>
      </div>
    </div>
  );
}
