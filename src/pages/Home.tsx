import CompanySelector from '@/components/CompanySelector.tsx';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button.tsx';

export function Home() {
  return (
    <div className="flex flex-col gap-3 p-6 w-[300px]">
      <Link to="/new-loan">
        <Button variant="outline" className="w-full">
          New Loan
        </Button>
      </Link>
      <Link to="/release-loan">
        <Button variant="outline" className="w-full">
          Release Loan
        </Button>
      </Link>
      <Link to="/daily-summary">
        <Button variant="outline" className="w-full">
          Daily Summary
        </Button>
      </Link>
      <Link to="/table-view">
        <Button variant="outline" className="w-full">
          Table View
        </Button>
      </Link>
      <CompanySelector />
    </div>
  );
}
