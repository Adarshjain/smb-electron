import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select"
import {useCompany} from "../context/CompanyProvider.tsx";

export default function SelectCompany() {
    const {company, setCompany, allCompanies} = useCompany()
    return (
        <Select
            onValueChange={(value: string) => {
                const selectedCompany = allCompanies.find(comp => comp.name === value) || null;
                if (selectedCompany) {
                    setCompany(selectedCompany);
                }
            }}
            value={company?.name}
        >
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Company"/>
            </SelectTrigger>
            <SelectContent>
                {allCompanies.map(comp => <SelectItem key={comp.name} value={comp.name}>{comp.name}</SelectItem>)}
            </SelectContent>
        </Select>
    )
}