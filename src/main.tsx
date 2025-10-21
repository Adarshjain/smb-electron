import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {CompanyProvider} from "./context/CompanyProvider.tsx";
import {ThanglishProvider} from "@/context/ThanglishProvider.tsx";

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <CompanyProvider>
            <ThanglishProvider>
                <App/>
            </ThanglishProvider>
        </CompanyProvider>
    </StrictMode>,
)
