import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip.tsx";
import {Badge} from "@/components/ui/badge.tsx";
import {cn} from "@/lib/utils.ts";
import {currentIsoDate, isToday, isValidIsoDate, nextIsoDate, previousIsoDate, viewableDate} from "@/lib/myUtils.tsx";
import {useMemo, useState} from "react";
import {useLocation} from "react-router-dom";
import {useCompany} from "@/context/CompanyProvider.tsx";
import {Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog.tsx";
import {Button} from "@/components/ui/button.tsx";
import DatePicker from "@/components/DatePicker.tsx";
import {ArrowLeft, ArrowRight} from "lucide-react";

export default function CurrentDateCrud() {
    const location = useLocation()
    const {company, setCurrentDate} = useCompany()
    const isHome = useMemo(() => location.pathname === '/', [location.pathname]);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [internalDate, setInternalDate] = useState<string>(company?.current_date || currentIsoDate());

    if (!company) {
        return null;
    }
    return <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger disabled={!isHome}>
            <Tooltip open={!isHome ? false : undefined}>
                <TooltipTrigger asChild>
                    <Badge
                        variant='secondary'
                        className={cn(
                            !isToday(company.current_date) ? 'bg-red-500 text-white px-2 py-1 border' : '',
                            isHome ? 'cursor-pointer' : 'cursor-default'
                        )}
                    >{viewableDate(company.current_date)}</Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="px-2 py-1 text-xs">
                    <p>Change Date</p>
                </TooltipContent>
            </Tooltip>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[450px]" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
                <DialogTitle>Change Current Date</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2">
                <DatePicker defaultValue={company.current_date} onInputChange={setInternalDate}/>
                <DialogClose asChild>
                    <Button
                        onClick={(e) => {
                            if (!isValidIsoDate(internalDate)) {
                                e.preventDefault();
                                return;
                            }
                            void setCurrentDate(internalDate)
                        }}
                        variant="outline"
                    >Set</Button>
                </DialogClose>
            </div>
            <DialogClose asChild>
                <div className="flex gap-2 justify-between">
                    <Button
                        onClick={() => setCurrentDate(previousIsoDate(company?.current_date))}
                        variant="outline"
                    ><ArrowLeft/> Previous Date</Button>
                    <Button variant="link">Cancel</Button>
                    <Button
                        onClick={() => setCurrentDate(nextIsoDate(company?.current_date))}
                    >Next Date<ArrowRight/></Button>
                </div>
            </DialogClose>
        </DialogContent>
    </Dialog>
}