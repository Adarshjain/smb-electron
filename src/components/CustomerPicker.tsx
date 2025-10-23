import {cn} from '@/lib/utils'
import {Command, CommandGroup, CommandItem, CommandList,} from '@/components/ui/command'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Check} from 'lucide-react'
import {useEffect, useRef, useState} from "react";
import {useVirtualizer} from '@tanstack/react-virtual'
import {query} from "@/hooks/dbUtil.ts";
import type {Tables} from "../../tables";
import {Input} from "@/components/ui/input.tsx";
import {useThanglish} from "@/context/ThanglishProvider.tsx";
import {encode} from "@/lib/thanglish/TsciiConverter.ts";
import {decodeRecord} from "@/lib/myUtils.tsx";

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
    const parentRef = useRef<HTMLDivElement>(null)

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 34, // Approximate height of each item in pixels
        overscan: 5, // Number of items to render outside the visible area
    })

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
        if (highlightedIndex >= 0 && highlightedIndex < items.length) {
            virtualizer.scrollToIndex(highlightedIndex, {
                align: 'auto',
                behavior: 'smooth'
            })
        }
    }, [highlightedIndex, virtualizer, items.length])

    const handleSelect = (opt: Tables['customers']['Row']) => {
        setSelected(opt)
        onChange?.(decodeRecord('customers', opt))
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
                        autoFocus
                        name="customer_picker"
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
            <PopoverContent className="p-0 w-[610px]" onOpenAutoFocus={(e) => e.preventDefault()}>
                <Command shouldFilter={false}>
                    <CommandList ref={parentRef} className="max-h-150 overflow-auto">
                        <CommandGroup>
                            <div
                                style={{
                                    height: `${virtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative',
                                }}
                            >
                                {virtualizer.getVirtualItems().map((virtualItem) => {
                                    const opt = decodeRecord('customers', items[virtualItem.index])
                                    const index = virtualItem.index
                                    return (
                                        <CommandItem
                                            key={opt.id}
                                            value={opt.id}
                                            onSelect={() => handleSelect(opt)}
                                            ref={(el) => {
                                                itemRefs.current[index] = el
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                transform: `translateY(${virtualItem.start}px)`,
                                            }}
                                            className={cn(
                                                index % 2 === 1 && "bg-accent",
                                                "data-[selected=true]:bg-blue-200 px-2 py-1 text-base",
                                                isKeyboardNavigating && highlightedIndex === index && "bg-blue-500 text-white data-[selected=true]:text-white data-[selected=true]:bg-blue-500",
                                            )}
                                        >
                                            <div className="w-[160px]">{opt.name}</div>
                                            <div className="w-[30px]">{opt.fhtitle}</div>
                                            <div className="w-[160px]">{opt.fhname}</div>
                                            <div className="w-[180px]">{opt.area}</div>
                                            {selected?.id === opt.id && (
                                                <Check className="ml-auto h-4 w-4"/>
                                            )}
                                        </CommandItem>
                                    )
                                })}
                            </div>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
