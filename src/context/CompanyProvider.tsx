import {createContext, useContext, useState, type ReactNode, useEffect} from 'react';
import type {Tables} from "../../tables";
import {getDBMethods} from "../hooks/dbUtil.ts";

interface CompanyContextType {
    company: Tables['companies']['Row'] | null;
    allCompanies: Tables['companies']['Row'][];
    setCompany: (company: Tables['companies']['Row']) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
    const [company, setCompany] = useState<Tables['companies']['Row'] | null>(null);
    const [allCompanies, setAllCompanies] = useState<Tables['companies']['Row'][]>([]);
    useEffect(() => {
        getDBMethods('companies').read({}).then((response) => {
            if (response.success && response.data && response.data.length > 0) {
                setAllCompanies(response.data as Tables['companies']['Row'][]);
                const companyMatch = (response.data as Tables['companies']['Row'][]).find(comp => comp.name === "Sri Mahaveer Bankers") || null
                setCompany(companyMatch);
            }
        })
    }, []);

    return (
        <CompanyContext.Provider value={{ company, setCompany, allCompanies }}>
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
