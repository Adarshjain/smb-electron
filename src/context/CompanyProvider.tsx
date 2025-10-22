import {createContext, type ReactNode, useContext, useEffect, useMemo, useState} from 'react';
import type {Tables} from "../../tables";
import {getDBMethods} from "../hooks/dbUtil.ts";
import {toastElectronResponse} from "@/lib/myUtils.tsx";

interface CompanyContextType {
    company: Tables['companies']['Row'] | null;
    allCompanies: Tables['companies']['Row'][];
    setCompany: (company: Tables['companies']['Row']) => void;
    setCurrentDate: (date: string) => Promise<void>;
    setNextSerial: (date: string) => Promise<void>;
    refetch: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({children}: { children: ReactNode }) {
    const [company, setCompany] = useState<Tables['companies']['Row'] | null>(null);
    const [allCompanies, setAllCompanies] = useState<Tables['companies']['Row'][]>([]);
    const {update, read} = useMemo(() => getDBMethods('companies'), []);

    const setCurrentDate = async (current_date: string) => {
        if (company) {
            toastElectronResponse(await update({
                current_date,
                name: company.name
            }));
            setCompany({...company, current_date});
        }
    }

    const setNextSerial = async (next_serial: string) => {
        if (company) {
            await update({
                next_serial,
                name: company.name
            });
            setCompany({...company, next_serial});
        }
    }

    const fetchCompanies = () => {
        read({}).then((response) => {
            if (response.success && response.data && response.data.length > 0) {
                setAllCompanies(response.data as Tables['companies']['Row'][]);
                const companyMatch = (response.data as Tables['companies']['Row'][]).find(comp => comp.is_default === 1) || response.data[0]
                setCompany(companyMatch);
            }
        })
    }

    useEffect(() => fetchCompanies, []);

    return (
        <CompanyContext.Provider value={{
            company,
            setCompany,
            allCompanies,
            setCurrentDate,
            setNextSerial,
            refetch: fetchCompanies
        }}>
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
