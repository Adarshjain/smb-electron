import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home.tsx';
import { Toaster } from '@/components/ui/sonner';
import { TableView } from '@/pages/TableView.tsx';
import Toolbar from '@/components/Toolbar.tsx';
import Settings from '@/pages/Settings.tsx';
import NewLoan from '@/pages/NewLoan.tsx';

function App() {
  return (
    <BrowserRouter>
      <Toolbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/table-view" element={<TableView />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/new-loan" element={<NewLoan />} />
      </Routes>
      <Toaster position="bottom-left" richColors theme="light" />
    </BrowserRouter>
  );
}

export default App;
