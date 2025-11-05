import { HomeIcon, RotateCw, SettingsIcon } from 'lucide-react';

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
import { Link, useLocation } from 'react-router-dom';
import { useThanglish } from '@/context/ThanglishProvider.tsx';
import { Button } from '@/components/ui/button.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';
import { useCompany } from '@/context/CompanyProvider.tsx';
import CurrentDateCrud from '@/components/CurrentDateCrud.tsx';
import { useEffect, useState } from 'react';

export default function Toolbar() {
  const { isTamil, setIsTamil } = useThanglish();
  const location = useLocation();
  const { company } = useCompany();
  const [title, setTitle] = useState('');

  useEffect(() => {
    switch (location.pathname) {
      case '/':
      default:
        setTitle('');
        break;
      case '/settings':
        setTitle('Settings');
        break;
      case '/new-loan':
        setTitle('Loan Editor');
        break;
      case '/release-loan':
        setTitle('Release Loans');
        break;
      case '/table-view':
        setTitle('Table View');
        break;
      case '/day-book':
        setTitle('Day Book');
        break;
    }
  }, [location]);

  return (
    <NavigationMenu className="w-full max-w-full border-b py-2 bg-gray-100">
      <div className="ml-2 w-1/3 flex items-center">
        <NavigationMenuList className="flex-wrap">
          <NavigationMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <NavigationMenuLink asChild>
                  <Link
                    to="/"
                    className={cn(
                      'flex size-8 items-center justify-center p-1.5 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer'
                    )}
                  >
                    <HomeIcon size={20} aria-hidden={true} />
                    <span className="sr-only">Home</span>
                  </Link>
                </NavigationMenuLink>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="px-2 py-1 text-xs">
                <p>Home</p>
              </TooltipContent>
            </Tooltip>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <NavigationMenuLink asChild>
                  <div
                    onClick={() => {
                      window.location.reload();
                    }}
                    className={cn(
                      'flex size-8 items-center justify-center p-1.5 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer'
                    )}
                  >
                    <RotateCw size={20} aria-hidden={true} />
                    <span className="sr-only">Refresh</span>
                  </div>
                </NavigationMenuLink>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="px-2 py-1 text-xs">
                <p>Refresh</p>
              </TooltipContent>
            </Tooltip>
          </NavigationMenuItem>
        </NavigationMenuList>
        <div className="ml-12 font-bold">{title}</div>
      </div>
      {company ? (
        <div className="w-1/3  flex justify-center">
          <div>
            {company.name} <CurrentDateCrud />
          </div>
        </div>
      ) : null}
      <div className="flex justify-end mr-4 gap-3 w-1/3 items-center">
        <Button
          className={`text-white cursor-pointer py-1 h-7 ${isTamil ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'}`}
          onClick={() => setIsTamil(!isTamil)}
        >
          {isTamil ? 'Tamil' : 'English'}
        </Button>
        <NavigationMenuList>
          <NavigationMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <NavigationMenuLink asChild>
                  <Link
                    to="/settings"
                    className={cn(
                      'flex size-8 items-center justify-center p-1.5 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer'
                    )}
                  >
                    <SettingsIcon size={20} aria-hidden={true} />
                    <span className="sr-only">Home</span>
                  </Link>
                </NavigationMenuLink>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="px-2 py-1 text-xs">
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </NavigationMenuItem>
        </NavigationMenuList>
      </div>
    </NavigationMenu>
  );
}
