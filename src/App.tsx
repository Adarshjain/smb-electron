import { HashRouter, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home.tsx';
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
    </HashRouter>
  );
}
