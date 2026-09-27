import { AlertTriangleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';

// Stays up until a backup succeeds. A failing backup used to be silent, and
// one bad row kept most of the data off Supabase for ten days unnoticed.
export default function BackupFailedBanner({ errors }: { errors: string[] }) {
  return (
    <div className="flex items-start gap-3 bg-red-600 text-white px-4 py-2">
      <AlertTriangleIcon size={20} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold">
          Backup failed. New work is saved on this computer but is not backed up
          to Supabase.
        </div>
        <ul className="text-sm opacity-90">
          {errors.map((error) => (
            <li key={error} className="truncate" title={error}>
              {error}
            </li>
          ))}
        </ul>
      </div>
      <Button
        variant="secondary"
        className="h-7 shrink-0"
        onClick={() => void window.api.supabase.sync()}
      >
        Try again
      </Button>
    </div>
  );
}
