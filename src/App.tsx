import {BrowserRouter, Route, Routes} from "react-router-dom";
import {Home} from "./pages/Home.tsx";
import { Toaster } from "@/components/ui/sonner"
import AreaView from "@/components/AreaView.tsx";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home/>}/>
                <Route path="/areas" element={<AreaView />}/>
            </Routes>
            <Toaster position="bottom-left" richColors theme="light" />
        </BrowserRouter>
    );
}

export default App;
