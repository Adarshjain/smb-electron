import {useCompany} from "../context/CompanyProvider.tsx";
import SelectCompany from "../components/SelectCompany.tsx";
import DatePicker from "@/components/DatePicker.tsx";
import {useState} from "react";

export function Home() {
    const {company} = useCompany();
    const [dateString, setDateString] = useState("");
    return <div>
        <SelectCompany />
        <DatePicker onInput={setDateString}/>
        <h1 className="text-2xl">Company: {company?.name}</h1>
        <div>{company?.current_date}</div>
        <div className="text-xl">{dateString}</div>
    </div>
}