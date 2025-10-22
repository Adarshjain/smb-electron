import {useCompany} from "@/context/CompanyProvider.tsx";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table.tsx";
import { Badge } from "@/components/ui/badge"
import {toastElectronResponse, viewableDate} from "@/lib/myUtils.tsx";
import {Button} from "@/components/ui/button.tsx";
import {CrudCompany} from "@/components/CrudCompany.tsx";
import ConfirmationDialog from "@/components/ConfirmationDialog.tsx";
import {getDBMethods} from "@/hooks/dbUtil.ts";
import type {Tables} from "../../tables";

export default function CompanySettings() {
    const {allCompanies, refetch} = useCompany();

    const deleteCompany = async (company: Tables['companies']['Row']) => {
        if (company.is_default) {
            alert("Cannot delete the default company. Please set another company as default before deleting this one.");
            return;
        }
        const response = await getDBMethods('companies').deleteRecord({
            name: company.name
        });
        toastElectronResponse(response);
        refetch();
    }

    return <div className="w-[650px]">
        <div className="text-xl font-medium py-3 flex justify-between">
            Companies
            <CrudCompany label={<Button variant="outline" className="cursor-pointer">Add Company</Button>} onSave={refetch}/>
        </div>
        <Table className="border rounded">
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Current Date</TableHead>
                    <TableHead>Next Loan Number</TableHead>
                    <TableHead></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {allCompanies.map(record => (
                    <TableRow key={record.name}>
                        <TableCell>{record.name}{record.is_default === 1 ? <Badge className="ml-4 bg-blue-500 text-white">Default</Badge> : null}</TableCell>
                        <TableCell className="tabular-nums">{viewableDate(record.current_date)}</TableCell>
                        <TableCell>{record.next_serial}</TableCell>
                        <TableCell>
                            <CrudCompany label={<Button variant="link" className="cursor-pointer">Edit</Button>} company={record} onSave={refetch}/>
                            <ConfirmationDialog
                                trigger={<Button variant="link" className="cursor-pointer">Delete</Button>}
                                title={`Delete ${record.name}?`}
                                onConfirm={() => deleteCompany(record)}
                                confirmText="Delete"
                                isDestructive
                            />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>

    </div>;
}