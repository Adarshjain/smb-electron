import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { App } from './App.tsx';

interface Tab {
  id: string;
  title: string;
  content: ReactNode;
  isMain?: boolean;
}

interface TabContextType {
  openTab: (title: string, component: ReactNode) => void;
}

const TabContext = createContext<TabContextType | null>(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useTabs = () => {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('useTabs must be used within TabManager');
  return ctx;
};

export const TabManager: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>(() => [
    {
      id: 'main',
      title: 'Main',
      content: <App />,
      isMain: true,
    },
  ]);

  const [activeTabId, setActiveTabId] = useState('main');

  const openTab = (title: string, component: ReactNode) => {
    const id = Math.random().toString(36).substring(2, 9);
    setTabs((prev) => [...prev, { id, title, content: component }]);
    setActiveTabId(id);
  };

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => prev.filter((t) => t.id !== id));
      if (activeTabId === id) setActiveTabId('main');
    },
    [activeTabId]
  );

  const switchTab = (id: string) => setActiveTabId(id);

  // Memoize the tab bar so UI updates don’t reset children
  const tabBar = useMemo(
    () => (
      <div className="flex bg-gray-100 border-b border-gray-300">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`px-4 py-2 cursor-pointer flex items-center ${
              tab.id === activeTabId
                ? 'bg-white border-t-2 border-blue-600'
                : ''
            }`}
            onClick={() => switchTab(tab.id)}
          >
            {tab.title}
            {!tab.isMain && (
              <button
                className="ml-2 text-gray-400 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    ),
    [tabs, activeTabId, closeTab]
  );

  return (
    <TabContext.Provider value={{ openTab }}>
      <div className="flex flex-col h-screen">
        {tabs.length > 1 ? tabBar : null}

        {/* Keep all tabs mounted; just hide inactive ones */}
        <div className="flex-1 relative overflow-hidden">
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
    </TabContext.Provider>
  );
};
