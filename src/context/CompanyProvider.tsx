import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { LocalTables } from '@/../tables';
import { read, update } from '../hooks/dbUtil.ts';
import { errorToast, getNextSerial } from '@/lib/myUtils.tsx';

interface CompanyContextType {
  company: LocalTables<'companies'> | null;
  allCompanies: LocalTables<'companies'>[];
  setCompany: (company: LocalTables<'companies'>) => void;
  setCurrentDate: (date: string) => Promise<void>;
  setNextSerial: (date?: string) => Promise<void>;
  cycleCompany: () => void;
  refetch: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<LocalTables<'companies'> | null>(null);
  const [allCompanies, setAllCompanies] = useState<LocalTables<'companies'>[]>(
    []
  );

  const setCurrentDate = async (current_date: string) => {
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
  };

  const setNextSerial = async (next_serial?: string) => {
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
  };

  const fetchCompanies = useCallback(() => {
    read('companies', {})
      .then((response) => {
        if (response?.length) {
          setAllCompanies(response);
          if (company === null) {
            const companyMatch =
              response.find((comp) => comp.is_default === 1) ?? response[0];
            setCompany(companyMatch);
          } else {
            const matched = response.find((c) => c.name === company.name);
            if (matched) {
              setCompany(matched);
            }
          }
        }
      })
      .catch(errorToast);
  }, [company]);

  const cycleCompany = () => {
    const matchedIndex = allCompanies.findIndex(
      (c) => c.name === company?.name
    );
    if (matchedIndex !== -1) {
      setCompany(allCompanies[(matchedIndex + 1) % allCompanies.length]);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  return (
    <CompanyContext.Provider
      value={{
        company,
        setCompany,
        allCompanies,
        setCurrentDate,
        setNextSerial,
        refetch: fetchCompanies,
        cycleCompany,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
