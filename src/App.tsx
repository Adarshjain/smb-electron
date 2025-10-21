import {BrowserRouter, Route, Routes} from "react-router-dom";
import {Home} from "./pages/Home.tsx";
import { Toaster } from "@/components/ui/sonner"
import {TableView} from "@/components/TableView.tsx";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home/>}/>
                <Route path="/table-view" element={<TableView />}/>
            </Routes>
            <Toaster position="bottom-left" richColors theme="light" />
        </BrowserRouter>
    );
}

export default App;
