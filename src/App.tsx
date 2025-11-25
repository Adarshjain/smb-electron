import { HashRouter, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home.tsx';
import { TableView } from '@/pages/TableView.tsx';
import Settings from '@/pages/Settings.tsx';
import NewLoan from '@/pages/NewLoan.tsx';
import ReleaseLoan from '@/pages/ReleaseLoan.tsx';
import DayBook from '@/pages/DayBook.tsx';
import CustomerCrud from '@/pages/CustomerCrud.tsx';
import { ErrorBoundary } from '@/components/ErrorBoundary.tsx';
import IncorrectCustomer from '@/components/IncorrectCustomer.tsx';

export function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/table-view" element={<TableView />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/incorrect-customers" element={<IncorrectCustomer />} />
          <Route path="/new-loan" element={<NewLoan />} />
          <Route path="/release-loan" element={<ReleaseLoan />} />
          <Route path="/day-book" element={<DayBook />} />
          <Route path="/customer-crud" element={<CustomerCrud />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
