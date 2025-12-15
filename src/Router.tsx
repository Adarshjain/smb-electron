import { Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home.tsx';
import { ErrorBoundary } from '@/components/ErrorBoundary.tsx';
import { TableView } from '@/pages/TableView.tsx';
import Settings from '@/pages/Settings.tsx';
import OtherCustomer from '@/components/OtherCustomer.tsx';
import NewLoan from '@/pages/NewLoan.tsx';
import ReleaseLoan from '@/pages/ReleaseLoan.tsx';
import DayBook from '@/pages/DayBook.tsx';
import CustomerCrud from '@/pages/CustomerCrud.tsx';
import CustomersByArea from '@/components/CustomersByArea.tsx';
import AccountHead from '@/components/AccountHead.tsx';
import ItemsMaster from '@/components/ItemsMaster.tsx';
import Dashboard from '@/components/Dashboard.tsx';
import OldLoans from '@/components/OldLoans.tsx';

// Simple loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  );
}

export function Router() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/table-view" element={<TableView />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/other-customers" element={<OtherCustomer />} />
            <Route path="/new-loan" element={<NewLoan />} />
            <Route path="/release-loan" element={<ReleaseLoan />} />
            <Route path="/day-book" element={<DayBook />} />
            <Route path="/customer-crud" element={<CustomerCrud />} />
            <Route path="/customer-by-area" element={<CustomersByArea />} />
            <Route path="/account-head" element={<AccountHead />} />
            <Route path="/items-master" element={<ItemsMaster />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/old-loans" element={<OldLoans />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </ErrorBoundary>
  );
}
