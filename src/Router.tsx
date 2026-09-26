import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home.tsx';
import { ErrorBoundary } from '@/components/ErrorBoundary.tsx';

// Everything except Home is loaded on demand so it isn't parsed at startup.
const loadNewLoan = () => import('@/pages/NewLoan.tsx');
const loadReleaseLoan = () => import('@/pages/ReleaseLoan.tsx');
const loadDayBook = () => import('@/pages/DayBook.tsx');

const TableView = lazy(() =>
  import('@/pages/TableView.tsx').then((m) => ({ default: m.TableView }))
);
const Settings = lazy(() => import('@/pages/Settings.tsx'));
const OtherCustomer = lazy(() => import('@/components/OtherCustomer.tsx'));
const NewLoan = lazy(loadNewLoan);
const ReleaseLoan = lazy(loadReleaseLoan);
const DayBook = lazy(loadDayBook);
const CustomerCrud = lazy(() => import('@/pages/CustomerCrud.tsx'));
const CustomersByArea = lazy(() => import('@/components/CustomersByArea.tsx'));
const AccountHead = lazy(() => import('@/components/AccountHead.tsx'));
const ItemsMaster = lazy(() => import('@/components/ItemsMaster.tsx'));
const OldLoans = lazy(() => import('@/components/OldLoans.tsx'));
const ReleaseInterest = lazy(() => import('@/components/ReleaseInterest.tsx'));
const NameCorrector = lazy(() => import('@/components/NameCorrector.tsx'));

// Warm up the screens behind the F2/F3/F8 shortcuts once the app is idle,
// so opening them stays instant.
function usePreloadCommonScreens() {
  useEffect(() => {
    const preload = () => {
      void loadNewLoan();
      void loadReleaseLoan();
      void loadDayBook();
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(preload, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(preload, 1500);
    return () => clearTimeout(id);
  }, []);
}

// Simple loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  );
}

export function Router() {
  usePreloadCommonScreens();

  return (
    <ErrorBoundary>
      <HashRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/table-view" element={<TableView />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/other-customers" element={<OtherCustomer />} />
            <Route path="/name-corrector" element={<NameCorrector />} />
            <Route path="/new-loan" element={<NewLoan />} />
            <Route path="/release-loan" element={<ReleaseLoan />} />
            <Route path="/day-book" element={<DayBook />} />
            <Route path="/release-interest" element={<ReleaseInterest />} />
            <Route path="/customer-crud" element={<CustomerCrud />} />
            <Route path="/customer-by-area" element={<CustomersByArea />} />
            <Route path="/account-head" element={<AccountHead />} />
            <Route path="/items-master" element={<ItemsMaster />} />
            <Route path="/old-loans" element={<OldLoans />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </ErrorBoundary>
  );
}
