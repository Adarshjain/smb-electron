import CompanySelector from '@/components/CompanySelector.tsx';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.tsx';
import { useEffect } from 'react';

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
    <div className="flex flex-col gap-3 p-6 w-[300px]">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => void navigate('/new-loan')}
      >
        New Loan
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => void navigate('/release-loan')}
      >
        Release Loan
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => void navigate('/day-book')}
      >
        Day Book
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => void navigate('/table-view')}
      >
        Table View
      </Button>
      <CompanySelector />
    </div>
  );
}
