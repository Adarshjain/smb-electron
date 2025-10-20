import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
    return (
        <BrowserRouter>
            <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
                <button onClick={async () => console.log(await window.api.supabase.initialPull())}>trigger sync</button>
                <Routes>
                    {/*<Route path="/settings" element={<Settings />} />*/}
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;
