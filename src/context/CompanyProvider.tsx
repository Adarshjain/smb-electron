import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { LocalTables } from '@/../tables';
import { read, update } from '../hooks/dbUtil.ts';
import { errorToast, getNextSerial } from '@/lib/myUtils.tsx';

interface CompanyContextType {
  company: LocalTables<'companies'> | null;
  companyColor: string;
  allCompanies: LocalTables<'companies'>[];
  setCompany: (company: LocalTables<'companies'>) => void;
  setCurrentDate: (date: string) => Promise<void>;
  setNextSerial: (next_serial?: string) => Promise<void>;
  cycleCompany: () => void;
  refetch: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<LocalTables<'companies'> | null>(null);
  const [allCompanies, setAllCompanies] = useState<LocalTables<'companies'>[]>(
    []
  );

  const companyColor = useMemo(() => {
    if (!company) return '';
    return company.name === 'Mahaveer Bankers' ? 'yellow' : 'blue';
  }, [company]);

  const fetchCompanies = useCallback(() => {
    read('companies', {})
      .then((response) => {
        if (response?.length) {
          setAllCompanies(response);
          // Use setState callback form to access current company without adding it as dependency
          setCompany((currentCompany) => {
            if (currentCompany === null) {
              return (
                response.find((comp) => comp.is_default === 1) ?? response[0]
              );
            } else {
              const matched = response.find(
                (c) => c.name === currentCompany.name
              );
              return matched ?? currentCompany;
            }
          });
        }
      })
      .catch(errorToast);
  }, []);

  const setCurrentDate = useCallback(
    async (current_date: string) => {
      if (company) {
        try {
          await update('companies', {
            current_date,
            name: company.name,
          });
          fetchCompanies();
        } catch (error) {
          errorToast(error);
        }
      }
    },
    [company, fetchCompanies]
  );

  const setNextSerial = useCallback(
    async (next_serial?: string) => {
      if (company) {
        if (!next_serial) {
          const [serial, loanNo] = company.next_serial.split('-');
          next_serial = getNextSerial(serial, loanNo).join('-');
        }
        await update('companies', {
          next_serial,
          name: company.name,
        });
        fetchCompanies();
      }
    },
    [company, fetchCompanies]
  );

  const cycleCompany = useCallback(() => {
    const matchedIndex = allCompanies.findIndex(
      (c) => c.name === company?.name
    );
    if (matchedIndex !== -1) {
      setCompany(allCompanies[(matchedIndex + 1) % allCompanies.length]);
    }
  }, [allCompanies, company?.name]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Memoize the context value to prevent unnecessary re-renders in consumers
  const value = useMemo(
    () => ({
      company,
      setCompany,
      allCompanies,
      setCurrentDate,
      setNextSerial,
      refetch: fetchCompanies,
      cycleCompany,
      companyColor,
    }),
    [
      company,
      allCompanies,
      setCurrentDate,
      setNextSerial,
      fetchCompanies,
      cycleCompany,
      companyColor,
    ]
  );

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
