import {useCompany} from "../context/CompanyProvider.tsx";
import SelectCompany from "../components/SelectCompany.tsx";
import DatePicker from "@/components/DatePicker.tsx";
import {useState} from "react";
import {Button} from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input"
import {CompanySetting} from "@/components/CompanySetting.tsx";

export function Home() {
    const {company, setCurrentDate, setNextSerial} = useCompany();
    const [dateString, setDateString] = useState("");
    const [serialString, setSerialString] = useState("");

    const setDate = async () => {
        if (company && dateString) {
            try {
                await setCurrentDate(dateString);
            } catch (e) {
                console.error(e)
            }
        }
    }

    const setSerial = async () => {
        if (company && serialString) {
            try {
                await setNextSerial(serialString);
            } catch (e) {
                console.error(e)
            }
        }
    }

    return <div>
        <CompanySetting />
        {/*<SelectCompany/>*/}
        {/*<DatePicker defaultValue={company?.current_date} onInput={setDateString}/>*/}
        {/*<h1 className="text-2xl">Company: {company?.name}</h1>*/}
        {/*<div>{company?.current_date}</div>*/}
        {/*<div>{company?.next_serial}</div>*/}
        {/*<Input onChange={(e) => setSerialString(e.target.value)} value={serialString} />*/}
        {/*<div className="text-xl">{dateString}</div>*/}
        {/*<Button onClick={setDate}>Set Date</Button>*/}
        {/*<Button onClick={setSerial}>Set Serial</Button>*/}
    </div>
}