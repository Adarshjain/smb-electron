import {useCompany} from "../context/CompanyProvider.tsx";
import SelectCompany from "../components/SelectCompany.tsx";
import DatePicker from "@/components/DatePicker.tsx";
import {useState} from "react";
import {Button} from "@/components/ui/button.tsx"

export function Home() {
    const {company, setCurrentDate} = useCompany();
    const [dateString, setDateString] = useState("");

    const setDate = async () => {
        if (company && dateString) {
            try {
                await setCurrentDate(dateString);
            } catch (e) {
                console.error(e)
            }
        }
    }

    return <div>
        <SelectCompany/>
        <DatePicker defaultValue={company?.current_date} onInput={setDateString}/>
        <h1 className="text-2xl">Company: {company?.name}</h1>
        <div>{company?.current_date}</div>
        <div className="text-xl">{dateString}</div>
        <Button onClick={setDate}>Set Date</Button>
    </div>
}