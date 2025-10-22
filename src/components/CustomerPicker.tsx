import {cn} from '@/lib/utils'
import {Command, CommandGroup, CommandItem, CommandList,} from '@/components/ui/command'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Check} from 'lucide-react'
import {useEffect, useState, useRef} from "react";
import {query} from "@/hooks/dbUtil.ts";
import type {Tables} from "../../tables";
import {Input} from "@/components/ui/input.tsx";
import {useThanglish} from "@/context/ThanglishProvider.tsx";
import {decode, encode} from "@/lib/thanglish/TsciiConverter.ts";

interface SearchableSelectProps {
    onChange?: (value: Tables['customers']['Row']) => void
    placeholder?: string
}

export default function CustomerPicker({
   onChange,
   placeholder = 'Search Customer...',
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [items, setItems] = useState<Tables['customers']['Row'][]>([])
    const [selected, setSelected] = useState<Tables['customers']['Row'] | null>(null)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [isKeyboardNavigating, setIsKeyboardNavigating] = useState(false)
    const {convert} = useThanglish()
    const inputRef = useRef<HTMLInputElement>(null)
    const itemRefs = useRef<(HTMLDivElement | null)[]>([])

    useEffect(() => {
        let active = true
        console.log('called')
        const run = async () => {
            const res = await query<Tables['customers']['Row'][]>(`SELECT * FROM customers WHERE name LIKE '${encode(search)}%'`)
            if (active) setItems(res.success ? res.data || [] : [])
        }
        if (search.length === 0) {
            setItems([])
            return
        }
        run()
        return () => {
            active = false
        }
    }, [search])

    useEffect(() => {
        if (items.length > 0) {
            setHighlightedIndex(0)
            setIsKeyboardNavigating(true)
        } else {
            setHighlightedIndex(-1)
            setIsKeyboardNavigating(false)
        }
    }, [items])

    useEffect(() => {
        if (itemRefs.current[highlightedIndex]) {
            itemRefs.current[highlightedIndex]?.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            })
        }
    }, [highlightedIndex])

    const handleSelect = (opt: Tables['customers']['Row']) => {
        setSelected(opt)
        onChange?.(opt)
        setOpen(false)
        setSearch('')
        setIsKeyboardNavigating(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open || items.length === 0) return

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setIsKeyboardNavigating(true)
                setHighlightedIndex((prev) => {
                    if (prev === -1) return 0
                    return (prev + 1) % items.length
                })
                break
            case 'ArrowUp':
                e.preventDefault()
                setIsKeyboardNavigating(true)
                setHighlightedIndex((prev) => {
                    if (prev === -1) return items.length - 1
                    return (prev - 1 + items.length) % items.length
                })
                break
            case 'Enter':
                e.preventDefault()
                if (highlightedIndex >= 0 && items[highlightedIndex]) {
                    handleSelect(items[highlightedIndex])
                }
                break
            case 'Escape':
                e.preventDefault()
                setOpen(false)
                setIsKeyboardNavigating(false)
                inputRef.current?.blur()
                break
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger className="w-[500px]" asChild>
                <div>
                    <Input
                        ref={inputRef}
                        value={search}
                        onChange={(e) => {
                            e.stopPropagation()
                            setSearch(convert(e.target.value))
                            setOpen(true)
                        }}
                        onFocus={(e) => {
                            e.stopPropagation()
                            setOpen(true)
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                    />
                </div>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" onOpenAutoFocus={(e) => e.preventDefault()}>
                <Command shouldFilter={false}>
                    <CommandList className="max-h-60 overflow-auto">
                        {/*<CommandEmpty>No results found.</CommandEmpty>*/}
                        <CommandGroup>
                            {items.map((opt, index) => (
                                <CommandItem
                                    key={opt.id}
                                    value={opt.id}
                                    onSelect={() => handleSelect(opt)}
                                    ref={(el) => {
                                        itemRefs.current[index] = el
                                    }}
                                    className={cn(
                                        index % 2 === 1 && "bg-accent",
                                        isKeyboardNavigating && highlightedIndex === index && "bg-blue-500 text-white",
                                        "data-[selected=true]:bg-blue-200",
                                    )}
                                >
                                    <div className="w-[160px]">{decode(opt.name)}</div>
                                    <div className="w-[30px]">{decode(opt.fhtitle)}</div>
                                    <div className="w-[160px]">{decode(opt.fhname)}</div>
                                    <div className="w-[200px]">{decode(opt.area)}</div>
                                    {selected?.id === opt.id && (
                                        <Check className="ml-auto h-4 w-4"/>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
