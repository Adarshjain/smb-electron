import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
    return (
        <BrowserRouter>
            <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
                <Routes>
                    {/*<Route path="/settings" element={<Settings />} />*/}
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;
