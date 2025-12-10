import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Router } from './Router.tsx';
import { RefreshCcw, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { useCompany } from '@/context/CompanyProvider.tsx';
import { isToday, viewableDate } from '@/lib/myUtils.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { useThanglish } from '@/context/ThanglishProvider.tsx';

interface Tab {
  id: string;
  title: string;
  content: ReactNode;
  isMain?: boolean;
}

interface TabContextType {
  openTab: (title: string, component: ReactNode) => void;
  switchToMain: () => void;
  closeTab: (id?: string) => void;
}

const TabContext = createContext<TabContextType | null>(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useTabs = () => {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('useTabs must be used within TabManager');
  return ctx;
};

export const TabManager: React.FC = () => {
  const { isTamil, setIsTamil } = useThanglish();
  const { company } = useCompany();
  const [tabs, setTabs] = useState<Tab[]>(() => [
    {
      id: 'main',
      title: 'Main',
      content: <Router />,
      isMain: true,
    },
  ]);

  const [activeTabId, setActiveTabId] = useState('main');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    window.api.supabase.onSyncStatus((data) => {
      setIsSyncing(data.state === 'started');
    });
  }, []);

  const openTab = (title: string, component: ReactNode) => {
    const id = Math.random().toString(36).substring(2, 9);
    setTabs((prev) => [...prev, { id, title, content: component }]);
    setActiveTabId(id);
  };

  const switchToMain = () => {
    setActiveTabId('main');
  };

  const closeTab = useCallback(
    (id?: string) => {
      id ??= activeTabId;
      const matchedIndex = tabs.findIndex((tab) => tab.id === id);
      if (activeTabId === id) {
        setActiveTabId(
          matchedIndex !== -1 ? tabs[matchedIndex - 1].id : 'main'
        );
      }
      setTabs((prev) => prev.filter((t) => t.id !== id));
    },
    [activeTabId, tabs]
  );

  const switchTab = (id: string) => setActiveTabId(id);

  // Memoize the tab bar so UI updates don’t reset children
  const tabBar = useMemo(
    () => (
      <div className="flex border-gray-300 justify-between items-center px-4 h-10 sticky top-0 bg-green-200 z-10">
        <div className="flex">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'py-1 pl-4 pr-2 inline-flex items-center border border-b-0 border-transparent rounded-t-lg focus:outline-hidden focus:text-gray-700 disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer',
                tab.id === activeTabId
                  ? 'bg-green-300 border-gray-200'
                  : 'hover:text-gray-700 hover:bg-blue-100 rounded',
                tab.isMain ? 'pr-4' : ''
              )}
              onClick={() => switchTab(tab.id)}
            >
              {tab.title}
              {!tab.isMain && (
                <XIcon
                  className="ml-2 w-5 h-5 p-0.5 text-gray-400 hover:bg-gray-300 rounded-3xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                />
              )}
            </div>
          ))}
        </div>
        {company ? (
          <div className="w-1/3 flex justify-center items-center gap-4">
            {company.name}{' '}
            <Badge
              variant="secondary"
              className={cn(
                !isToday(company.current_date)
                  ? 'bg-red-500 text-white px-2 py-1 border'
                  : ''
              )}
            >
              {viewableDate(company.current_date)}
            </Badge>
          </div>
        ) : null}
        <Button
          className={`text-white cursor-pointer py-1 h-7 ${isTamil ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'}`}
          onClick={() => setIsTamil(!isTamil)}
        >
          {isTamil ? 'Tamil' : 'English'}
        </Button>
      </div>
    ),
    [tabs, company, isTamil, activeTabId, closeTab, setIsTamil]
  );

  return (
    <TabContext.Provider value={{ openTab, switchToMain, closeTab }}>
      <div className="flex flex-col h-screen bg-green-200 overflow-auto">
        {tabBar}

        {/* Keep all tabs mounted; just hide inactive ones */}
        <div className="flex-1 relative z-1">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 transition-opacity duration-150 ${
                tab.id === activeTabId
                  ? 'opacity-100 z-10'
                  : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {tab.content}
            </div>
          ))}
        </div>
      </div>
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
      {isSyncing ? (
        <>
          <div className="fixed left-0 w-full top-0 h-full pointer-events-auto z-[9998] bg-blue-50 opacity-80"></div>
          <div className="fixed left-0 right-0 top-0 bottom-0 pointer-events-auto z-[9999] flex place-items-center">
            <div className="flex flex-col items-center bg-white shadow rounded-xl px-18 py-12 m-auto gap-8 text-xl">
              <input type="text" className="opacity-0 h-0 w-0" autoFocus />
              <RefreshCcw size={42} />
              Taking back up, please wait...
            </div>
          </div>
        </>
      ) : null}
    </TabContext.Provider>
  );
};
