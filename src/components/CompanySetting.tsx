import {Button} from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import DatePicker from "@/components/DatePicker.tsx";
import {Checkbox} from "@/components/ui/checkbox"
import type {Tables} from "../../tables";
import {toast} from "sonner";
import {useState} from "react";

export function CompanySetting(props: {
    company?: Tables['companies']['Row']
}) {
    const [isCreate] = useState(!props.company)

    const onSubmit = () => {

    }

    return (
        <Dialog defaultOpen>
            <DialogTrigger asChild>
                <Button variant="outline">{isCreate ? 'Create Company' : `Edit Company`}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>{isCreate ? 'Create Company' : `Edit Company`}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-3">
                        <Label htmlFor="company-name">Name</Label>
                        <Input id="company-name" name="company-name" defaultValue={props.company?.name}/>
                    </div>
                    <div className="grid gap-3">
                        <Label htmlFor="username-1">Current Date (Close day)</Label>
                        <DatePicker defaultValue={props.company?.current_date}/>
                    </div>
                    <div className="flex items-start gap-3">
                        <Checkbox id="terms"/>
                        <div className="grid gap-2">
                            <Label htmlFor="terms">Default</Label>
                            <p className="text-muted-foreground text-sm">
                                This company will be selected by default when app launches
                            </p>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={onSubmit}>{isCreate ? 'Save Changes' : 'Create Company'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
