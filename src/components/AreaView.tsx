import {useEffect, useState} from "react";
import {getDBMethods} from "@/hooks/dbUtil.ts";
import type {Tables} from "../../tables";
import {rpcError} from "@/lib/myUtils.tsx";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {decode} from "@/lib/thanglish/TsciiConverter.ts";
import {Input} from "@/components/ui/input.tsx";
import {useThanglish} from "@/context/ThanglishProvider.tsx";

export default function AreaView() {
    const [areas, setAreas] = useState<Tables['areas']['Row'][]>([]);
    const [search, setSearch] = useState<string>("");
    const [filteredAreas, setFilteredAreas] = useState<Tables['areas']['Row'][]>(areas)
    const {convert} = useThanglish();

    useEffect(() => {
        getDBMethods('areas').read({}).then((response) => {
            if (response.success) {
                setAreas(response.data || []);
            } else {
                rpcError(response);
            }
        })
    }, []);

    useEffect(() => {
        if (!search.trim()) {
            setFilteredAreas(areas);
            return;
        }
        const lowerSearch = search.toLowerCase();
        const filtered = areas.filter(area =>
            decode(area.name).toLowerCase().includes(lowerSearch) ||
            decode(area.post)?.toLowerCase().includes(lowerSearch) ||
            decode(area.town)?.toLowerCase().includes(lowerSearch) ||
            area.pincode?.toString().includes(lowerSearch)
        );
        setFilteredAreas(filtered);
    }, [areas, search]);

    return <div>
        <div className="text-2xl bold text-center">Areas</div>
        <Input
            value={search}
            onInput={(e) => setSearch(convert((e.target as HTMLInputElement).value))}
            placeholder="Search..."
        />
        <div className="p-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Areas</TableHead>
                        <TableHead>Post</TableHead>
                        <TableHead>Town</TableHead>
                        <TableHead>Pincode</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredAreas.map(area => (
                        <TableRow key={area.name}>
                            <TableCell>{decode(area.name)}</TableCell>
                            <TableCell>{decode(area.town)}</TableCell>
                            <TableCell>{decode(area.post)}</TableCell>
                            <TableCell>{area.pincode}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    </div>
}