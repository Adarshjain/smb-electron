import {createContext, useContext, useState, type ReactNode, useEffect} from 'react';
import type {Tables} from "../../tables";
import {getDBMethods} from "../hooks/dbUtil.ts";

interface CompanyContextType {
    company: Tables['companies']['Row'] | null;
    setCompany: (company: Tables['companies']['Row']) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
    const [company, setCompany] = useState<Tables['companies']['Row'] | null>(null);
    useEffect(() => {
        getDBMethods('companies').read({name: "Sri Mahaveer Bankers"}).then(response => {
            if (response.success && response.data && response.data.length > 0) {
                setCompany(response.data[0]);
            }
        })
    }, []);

    return (
        <CompanyContext.Provider value={{ company, setCompany }}>
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
