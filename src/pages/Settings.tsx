import CompanySettings from "@/components/CompanySettings.tsx";
import {Button} from "@/components/ui/button.tsx";
import ConfirmationDialog from "@/components/ConfirmationDialog.tsx";
import {AlertTriangleIcon} from "lucide-react";

export default function Settings() {
    return <div className="p-6 flex flex-col gap-3">
        <div className="text-2xl font-bold tracking-tight">Settings</div>
        <CompanySettings />
        <div className="text-xl font-medium flex items-center gap-1"><AlertTriangleIcon size={20} /> Danger Zone</div>
        <ConfirmationDialog
            trigger={<Button variant="destructive" size="sm" className="cursor-pointer w-min">Delete and Init DB</Button>}
            title={`Delete all entries and refresh?`}
            onConfirm={() => window.api.db.initSeed()}
            confirmText="Delete"
            isDestructive
        />
    </div>;
}