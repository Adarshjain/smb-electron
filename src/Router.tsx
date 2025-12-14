import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home.tsx';
import { ErrorBoundary } from '@/components/ErrorBoundary.tsx';

// Lazy load less frequently used pages for faster initial load
const TableView = lazy(() =>
  import('@/pages/TableView.tsx').then((m) => ({ default: m.TableView }))
);
const Settings = lazy(() => import('@/pages/Settings.tsx'));
const NewLoan = lazy(() => import('@/pages/NewLoan.tsx'));
const ReleaseLoan = lazy(() => import('@/pages/ReleaseLoan.tsx'));
const DayBook = lazy(() => import('@/pages/DayBook.tsx'));
const CustomerCrud = lazy(() => import('@/pages/CustomerCrud.tsx'));
const OtherCustomer = lazy(() => import('@/components/OtherCustomer.tsx'));
const CustomersByArea = lazy(() => import('@/components/CustomersByArea.tsx'));
const AccountHead = lazy(() => import('@/components/AccountHead.tsx'));
const ItemsMaster = lazy(() => import('@/components/ItemsMaster.tsx'));
const Dashboard = lazy(() => import('@/components/Dashboard.tsx'));
const OldLoans = lazy(() => import('@/components/OldLoans.tsx'));

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
