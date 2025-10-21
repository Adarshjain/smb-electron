import * as React from "react"
import {ArrowLeftIcon, HomeIcon} from "lucide-react"

import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from "@/components/ui/navigation-menu"
import {useLocation, useNavigate} from "react-router-dom";
import {useThanglish} from "@/context/ThanglishProvider.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip.tsx";
import {cn} from "@/lib/utils.ts";
import CompanySelector from "@/components/CompanySelector.tsx";

export default function Toolbar() {
    const {isTamil, setIsTamil} = useThanglish()
    const location = useLocation()
    const navigate = useNavigate()
    const [canGoBack, setCanGoBack] = React.useState(false)

    React.useEffect(() => {
        // Track if user has navigated within the app
        // We consider we can go back if we're not on the home page
        setCanGoBack(location.key !== 'default')
    }, [location])
    return (
        <NavigationMenu className="w-full max-w-full border-b py-1 flex justify-between">
            <div className="ml-2">
                <NavigationMenuList className="flex-wrap">
                    <NavigationMenuItem>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <NavigationMenuLink
                                    onClick={() => canGoBack && navigate(-1)}
                                    className={cn(
                                        'flex size-8 items-center justify-center p-1.5 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground',
                                        canGoBack ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed',
                                    )}
                                >
                                    <ArrowLeftIcon size={20} aria-hidden={true} />
                                    <span className="sr-only">Back</span>
                                </NavigationMenuLink>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="px-2 py-1 text-xs">
                                <p>Back</p>
                            </TooltipContent>
                        </Tooltip>
                    </NavigationMenuItem>
                    <NavigationMenuItem>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <NavigationMenuLink
                                    href={"/"}
                                    className={cn(
                                        'flex size-8 items-center justify-center p-1.5 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer',
                                    )}
                                >
                                    <HomeIcon size={20} aria-hidden={true} />
                                    <span className="sr-only">Home</span>
                                </NavigationMenuLink>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="px-2 py-1 text-xs">
                                <p>Home</p>
                            </TooltipContent>
                        </Tooltip>
                    </NavigationMenuItem>
                </NavigationMenuList>
            </div>
            <div className="flex items-center">
                {location.pathname === '/' ? <CompanySelector/> : null}
                <span className="mx-4 text-sm text-gray-600">{location.pathname}</span>
                <Button
                    className={`mr-4 text-white cursor-pointer py-1 h-7 ${isTamil ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'}`}
                    onClick={() => setIsTamil(!isTamil)}
                >{isTamil ? 'Tamil' : 'English'}</Button>
            </div>
        </NavigationMenu>
    )
}
