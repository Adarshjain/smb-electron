import {useCompany} from "../context/CompanyProvider.tsx";

export function Home() {
    const {company} = useCompany();
    return <div>
        <h1>Company: {company?.name}</h1>
        <div>{company?.current_date}</div>
    </div>
}