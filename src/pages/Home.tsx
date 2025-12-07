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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

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
          document.getElementById('company-switcher')?.click();
          break;
        }
        case 'F6': {
          const customerPicker = document.getElementsByName('customer_picker');
          if (customerPicker.length) {
            customerPicker[0].focus();
          }
          break;
        }
        case 'F5':
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
          <Kbd className="justify-self-start col-start-1">F5</Kbd>
          <div className="justify-self-center col-start-2">Cash Book</div>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full grid grid-cols-[1fr_auto_1fr] px-3 border-input font-normal"
            >
              <div className="justify-self-center col-start-2">More</div>
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[250px]">
            <DropdownMenuItem
              onClick={() => openTab('Profit & Loss', <ProfitAndLoss />)}
            >
              Profit & Loss
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => openTab('Balance Sheet', <BalanceSheet />)}
            >
              Balance Sheet
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void navigate('/other-customers')}>
              Other Customers
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void navigate('/customer-by-area')}
            >
              Customer By Area
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void navigate('/account-head')}>
              Account Head
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void navigate('/items-master')}>
              Items Master
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void navigate('/settings')}>
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
