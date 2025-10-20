import {useState} from "react";
import {cn} from "@/lib/utils.ts";

export interface IPropsDatePicker {
    onInput?: (date: string) => void;
    onEnter?: (date: string) => void;
    defaultValue?: string;
    isError?: boolean;
    className?: string;
}

export default function DatePicker(props: IPropsDatePicker) {
    const [isError, setIsError] = useState<boolean>(false);
    return <input
        type="date"
        defaultValue={props.defaultValue}
        onInput={(e) => {
            setIsError(!e.currentTarget.value)
            props.onInput?.(e.currentTarget.value)
        }}
        onKeyDown={(event) => {
            if (event.key === "Enter") {
                const target = event.target as HTMLInputElement;
                props.onEnter?.(target.value);
            }
        }}
        className={cn(`selection:bg-primary selection:text-primary-foreground ${isError || props.isError ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50 focus-visible:ring-[3px]' : 'border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'} h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:ring-destructive/20 aria-invalid:border-destructive [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none`, props.className)}
    />;
}