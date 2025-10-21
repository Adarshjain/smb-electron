import {CompanySettings} from "@/components/CompanySettings.tsx";
import {Input} from "@/components/ui/input.tsx";
import {useState} from "react";
import {useThanglish} from "@/context/ThanglishProvider.tsx";

export function Home() {
    const [value, setValue] = useState("");
    const {isTamil, setIsTamil, convert} = useThanglish();

    return <div>
        <div onClick={() => setIsTamil(!isTamil)}>{isTamil ? 'Tami' : 'Enlgish'}</div>
        <Input value={value} onInput={(e) => setValue(convert((e.target as HTMLInputElement).value))} placeholder="Type here..." />
        <CompanySettings />
    </div>
}