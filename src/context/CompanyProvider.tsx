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
        setCompany({ ...company, current_date });
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
      setCompany({ ...company, next_serial });
      allCompanies[
        allCompanies.findIndex((c) => company.name === c.name)
      ].next_serial = next_serial;
    }
  };

  const fetchCompanies = useCallback(() => {
    read('companies', {})
      .then((response) => {
        if (response?.length) {
          setAllCompanies(response);
          const companyMatch =
            response.find((comp) => comp.is_default === 1) ?? response[0];
          setCompany(companyMatch);
        }
      })
      .catch(errorToast);
  }, []);

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
