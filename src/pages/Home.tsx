import {CompanySettings} from "@/components/CompanySettings.tsx";
import {Input} from "@/components/ui/input.tsx";
import {useState} from "react";
import {useThanglish} from "@/context/ThanglishProvider.tsx";
import CompanySelector from "@/components/CompanySelector.tsx";
import {Link} from "react-router-dom";
import {Button} from "@/components/ui/button.tsx";

export function Home() {
    const [value, setValue] = useState("");
    const {isTamil, setIsTamil, convert} = useThanglish();

    return <div>
        <div onClick={() => setIsTamil(!isTamil)}>{isTamil ? 'Tamil' : 'English'}</div>
        <Input value={value} onInput={(e) => setValue(convert((e.target as HTMLInputElement).value))} placeholder="Type here..." />
        <CompanySelector />
        <CompanySettings />
        <Link to="/areas">
            <Button variant="ghost">Areas</Button>
        </Link>
    </div>
}