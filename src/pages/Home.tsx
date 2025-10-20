import {useCompany} from "../context/CompanyProvider.tsx";
import SelectCompany from "../components/SelectCompany.tsx";

export function Home() {
    const {company} = useCompany();
    return <div>
        <SelectCompany />
        <h1 className="text-2xl">Company: {company?.name}</h1>
        <div>{company?.current_date}</div>
    </div>
}