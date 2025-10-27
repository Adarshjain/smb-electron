import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { Tables } from '../../tables';
import { read, update } from '../hooks/dbUtil.ts';
import { toastElectronResponse } from '@/lib/myUtils.tsx';
import { toast } from 'sonner';

interface CompanyContextType {
  company: Tables['companies']['Row'] | null;
  allCompanies: Tables['companies']['Row'][];
  setCompany: (company: Tables['companies']['Row']) => void;
  setCurrentDate: (date: string) => Promise<void>;
  setNextSerial: (date?: string) => Promise<void>;
  refetch: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Tables['companies']['Row'] | null>(
    null
  );
  const [allCompanies, setAllCompanies] = useState<
    Tables['companies']['Row'][]
  >([]);
  const setCurrentDate = async (current_date: string) => {
    if (company) {
      toastElectronResponse(
        await update('companies', {
          current_date,
          name: company.name,
        })
      );
      setCompany({ ...company, current_date });
    }
  };

  const setNextSerial = async (next_serial?: string) => {
    if (company) {
      if (!next_serial) {
        const [serial, loanNo] = company.next_serial.split('-');
        let number = parseInt(loanNo, 10);
        let charCode = serial.charCodeAt(0);

        number += 1;

        if (number > 10000) {
          number = 1;
          charCode += 1;

          // Wrap from Z → A if needed
          if (charCode > 90) charCode = 65;
        }

        const newLetter = String.fromCharCode(charCode);
        next_serial = `${newLetter}-${number}`;
      }
      await update('companies', {
        next_serial,
        name: company.name,
      });
      setCompany({ ...company, next_serial });
    }
  };

  const fetchCompanies = () => {
    read('companies', {})
      .then((response) => {
        if (response.success && response.data && response.data.length > 0) {
          setAllCompanies(response.data as Tables['companies']['Row'][]);
          const companyMatch =
            (response.data as Tables['companies']['Row'][]).find(
              (comp) => comp.is_default === 1
            ) ?? response.data[0];
          setCompany(companyMatch);
        }
      })
      .catch(toast.error);
  };

  useEffect(() => fetchCompanies, []);

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
