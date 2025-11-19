import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils.ts';
import { ArrowLeft } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip.tsx';
import { useEffect } from 'react';

export default function GoHome() {
  const navigate = useNavigate();
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'F6') {
        void navigate('/');
      }
    };

    window.addEventListener('keydown', listener);

    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, [navigate]);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/"
          className={cn(
            'flex size-8 text-gray-500 items-center justify-center p-1.5 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer'
          )}
        >
          <ArrowLeft size={20} aria-hidden={true} />

          <span className="sr-only">Home</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="px-2 py-1 text-xs">
        <p>Home (F6)</p>
      </TooltipContent>
    </Tooltip>
  );
}
