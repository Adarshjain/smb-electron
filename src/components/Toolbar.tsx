import * as React from "react"
import {ArrowLeftIcon, HomeIcon, SettingsIcon} from "lucide-react"

import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from "@/components/ui/navigation-menu"
import {Link, useLocation, useNavigate} from "react-router-dom";
import {useThanglish} from "@/context/ThanglishProvider.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip.tsx";
import {cn} from "@/lib/utils.ts";
import {useCompany} from "@/context/CompanyProvider.tsx";
import CurrentDateCrud from "@/components/CurrentDateCrud.tsx";

export default function Toolbar() {
    const {isTamil, setIsTamil} = useThanglish()
    const location = useLocation()
    const navigate = useNavigate()
    const {company} = useCompany()
    const [canGoBack, setCanGoBack] = React.useState(false)

    React.useEffect(() => {
        // React Router stores the current history index in window.history.state.idx
        // If idx > 0, there's history to go back to
        const historyState = window.history.state as { idx?: number } | null
        setCanGoBack((historyState?.idx ?? 0) > 0)
    }, [location])
    return (
        <NavigationMenu className="w-full max-w-full border-b py-1">
            <div className="ml-2 w-1/3 flex items-start">
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
                                    <ArrowLeftIcon size={20} aria-hidden={true}/>
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
                                <NavigationMenuLink asChild>
                                    <Link
                                        to="/"
                                        className={cn(
                                            'flex size-8 items-center justify-center p-1.5 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer',
                                        )}
                                    >
                                        <HomeIcon size={20} aria-hidden={true}/>
                                        <span className="sr-only">Home</span>
                                    </Link>
                                </NavigationMenuLink>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="px-2 py-1 text-xs">
                                <p>Home</p>
                            </TooltipContent>
                        </Tooltip>
                    </NavigationMenuItem>
                </NavigationMenuList>
            </div>
            {company ? <div className="w-1/3  flex justify-center">
                <div>{company.name} <CurrentDateCrud /></div>
            </div> : null}
            <div className="flex justify-end mr-4 gap-3 w-1/3">
                <Button
                    className={`text-white cursor-pointer py-1 h-7 ${isTamil ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'}`}
                    onClick={() => setIsTamil(!isTamil)}
                >{isTamil ? 'Tamil' : 'English'}</Button>
                <NavigationMenuList>
                    <NavigationMenuItem>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <NavigationMenuLink asChild>
                                    <Link
                                        to="/settings"
                                        className={cn(
                                            'flex size-8 items-center justify-center p-1.5 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer',
                                        )}
                                    >
                                        <SettingsIcon size={20} aria-hidden={true}/>
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
    )
}
