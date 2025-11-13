import { HashRouter, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home.tsx';
import { Toaster } from '@/components/ui/sonner';
import { TableView } from '@/pages/TableView.tsx';
import Toolbar from '@/components/Toolbar.tsx';
import Settings from '@/pages/Settings.tsx';
import NewLoan from '@/pages/NewLoan.tsx';
import ReleaseLoan from '@/pages/ReleaseLoan.tsx';
import DayBook from '@/pages/DayBook.tsx';
import CustomerCrud from '@/pages/CustomerCrud.tsx';

export function App() {
  return (
    <HashRouter>
      <Toolbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/table-view" element={<TableView />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/new-loan" element={<NewLoan />} />
        <Route path="/release-loan" element={<ReleaseLoan />} />
        <Route path="/day-book" element={<DayBook />} />
        <Route path="/customer-crud" element={<CustomerCrud />} />
      </Routes>
      <Toaster
        position="bottom-left"
        theme="light"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#1a1a1a',
            border: '1px solid #1a1a1a',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
            borderRadius: '10px',
            padding: '12px 16px',
          },
          classNames: {
            success: 'bg-green-600 text-white border-green-700',
            error: 'bg-red-600 text-white border-red-700',
            warning: 'bg-amber-500 text-white border-amber-600',
            info: 'bg-blue-600 text-white border-blue-700',
          },
        }}
      />
    </HashRouter>
  );
}
