import CompanySettings from '@/components/CompanySettings.tsx';
import { Button } from '@/components/ui/button.tsx';
import ConfirmationDialog from '@/components/ConfirmationDialog.tsx';
import { AlertTriangleIcon } from 'lucide-react';
import {
  errorToast,
  successToast,
  toastElectronResponse,
} from '@/lib/myUtils.tsx';
import { useNavigate } from 'react-router-dom';
import GoHome from '@/components/GoHome.tsx';

export default function Settings() {
  const navigate = useNavigate();

  const sync = async () => {
    try {
      const resp = await window.api.supabase.sync();
      if (!resp.success) {
        errorToast(resp.error);
      } else {
        successToast('Backup Complete');
      }
    } catch (error) {
      errorToast(error);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-3">
      <div className="flex">
        <GoHome />
        <div className="text-2xl font-bold tracking-tight ml-4">Settings</div>
      </div>
      <CompanySettings />
      <Button
        variant="outline"
        className="w-32"
        onClick={() => void navigate('/customer-crud')}
      >
        Customers
      </Button>
      <Button variant="outline" className="w-32" onClick={() => void sync()}>
        Back Up
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
