import CompanySettings from '@/components/CompanySettings.tsx';
import { Button } from '@/components/ui/button.tsx';
import ConfirmationDialog from '@/components/ConfirmationDialog.tsx';
import { AlertTriangleIcon } from 'lucide-react';
import { toastElectronResponse } from '@/lib/myUtils.tsx';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const navigate = useNavigate();
  return (
    <div className="p-6 flex flex-col gap-3">
      <div className="text-2xl font-bold tracking-tight">Settings</div>
      <CompanySettings />
      <Button
        variant="outline"
        className="w-32"
        onClick={() => void navigate('/customer-crud')}
      >
        <div className="justify-self-center col-start-2">Customers</div>
      </Button>
      <div className="text-xl font-medium flex items-center gap-1 mt-12">
        <AlertTriangleIcon size={20} /> Danger Zone
      </div>
      <Button
        variant="outline"
        className="w-32"
        onClick={() => void navigate('/table-view')}
      >
        View Database
      </Button>
      <ConfirmationDialog
        trigger={
          <Button
            variant="destructive"
            size="sm"
            className="cursor-pointer w-min"
          >
            Delete and Init DB
          </Button>
        }
        title={`Delete all entries and refresh?`}
        onConfirm={async () =>
          void toastElectronResponse(await window.api.db.initSeed())
        }
        confirmText="Delete"
        isDestructive
      />
    </div>
  );
}
