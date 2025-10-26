import CompanySelector from '@/components/CompanySelector.tsx';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button.tsx';

export function Home() {
  return (
    <div className="flex flex-col gap-3 p-6 w-[300px]">
      <Button variant="outline" asChild>
        <Link to="/new-loan">New Loan</Link>
      </Button>
      <Button variant="outline" disabled>
        <Link to="/new-loan">Release Loan</Link>
      </Button>
      <Button variant="outline" asChild>
        <Link to="/table-view">Table View</Link>
      </Button>
      <CompanySelector />
    </div>
  );
}
