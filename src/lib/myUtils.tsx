import {toast} from "sonner";
import {format} from "date-fns";
import type {ElectronToReactResponse} from "../../shared-types";
import type {MetalType, TableName, Tables} from "../../tables";
import {TablesSQliteSchema} from "../../tableSchema.ts";
import {decode, encode} from "@/lib/thanglish/TsciiConverter.ts";
import MyCache from "@/lib/MyCache.ts";
import {getDBMethods} from "@/hooks/dbUtil.ts";

export function mapToRegex(map: Record<string, string>) {
    return new RegExp(
        Object.keys(map)
            .sort((a, b) => {
                if (b.length === a.length) return a.localeCompare(b);
                return b.length - a.length;
            })
            .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|'),
        'g'
    );
}

export function log(...args: unknown[]) {
    const blueLabel =
        "color: white; background-color: #007bff; padding: 2px 4px; border-radius: 2px; font-weight: bold;";
    // const greenLabel =
    //     "color: white; background-color: #28a745; padding: 2px 4px; border-radius: 2px; font-weight: bold;";
    const resetStyle = ""; // An empty string resets the style
    const first = args.shift();

    console.log(`%c${first}%c`, blueLabel, resetStyle, ...args);
}

export function rpcError(response: { success: false; error: string; stack: string | undefined }) {
    toast.error(`Error: ${response.error}`, {
        description: <pre
            className="bg-code text-code-foreground mt-2 w-[320px] overflow-x-auto rounded-md p-4"><code>{response.stack}</code></pre>,
        classNames: {content: "flex flex-col gap-2"},
        style: {"--border-radius": "calc(var(--radius) + 4px)"} as React.CSSProperties,
    })
}

export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function viewableDate(dateStr: string): string {
    return format(new Date(dateStr), "dd/MM/yyyy");
}

export function isToday(dateStr: string): boolean {
    const date = new Date(dateStr);
    const today = new Date();
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
}

export function currentIsoDate() {
    return new Date().toISOString().split('T')[0]
}

export function nextIsoDate(dateStr?: string): string {
    const date = new Date(dateStr || currentIsoDate());
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
}

export function previousIsoDate(dateStr?: string): string {
    const date = new Date(dateStr || currentIsoDate());
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
}

export function isValidIsoDate(dateStr: string): boolean {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return isoDateRegex.test(dateStr);
}

export function toastElectronResponse<T>(response: ElectronToReactResponse<T>, successMessage = 'Success') {
    if (!response.success) {
        if (response.error === 'UNIQUE constraint failed') {
            toast.error('Already exists!');
        } else {
            rpcError(response)
        }
    } else {
        toast.success(successMessage)
    }
}

export function decodeRecord<K extends TableName>(tableName: K, record: Tables[K]['Row']): Tables[K]['Row'] {
    const columnSchema = TablesSQliteSchema[tableName].columns;
    const encodedKeys = Object.keys(record).filter(key => columnSchema[key]?.encoded) as (keyof Tables[K]['Row'])[];

    if (encodedKeys.length === 0) {
        return record;
    }

    const decodedRecord = {...record};
    for (const key of encodedKeys) {
        decodedRecord[key] = decode(record[key as keyof Tables[K]['Row']] as string) as Tables[K]['Row'][typeof key];
    }

    return decodedRecord;
}

export function encodeRecord<K extends TableName>(tableName: K, record: Tables[K]['Row']): Tables[K]['Row'] {
    const columnSchema = TablesSQliteSchema[tableName].columns;
    const encodedKeys = Object.keys(record).filter(key => columnSchema[key]?.encoded) as (keyof Tables[K]['Row'])[];

    if (encodedKeys.length === 0) {
        return record;
    }

    const encodedRecord = {...record};
    for (const key of encodedKeys) {
        encodedRecord[key] = encode(record[key as keyof Tables[K]['Row']] as string) as Tables[K]['Row'][typeof key];
    }

    return encodedRecord;
}

export async function getRate(principal: number, metalType: MetalType): Promise<Tables['interest_rates']['Row'] | undefined> {
    const cache = new MyCache<Tables['interest_rates']['Row'][]>('IntRates');
    let intRates = cache.get('intRates');
    if (!intRates) {
        const response = await getDBMethods('interest_rates').read({});
        if (response.success) {
            cache.set('intRates', response.data || []);
            intRates = response.data || []
        }
    }
    return intRates?.find(rate => {
        if (rate.metal_type === metalType) {
            if (principal >= rate.from_ && principal <= rate.to_) {
                return rate;
            }
        }
    })
}

export function getInterest(principal: number, intRate: number, months = 1) {
    return +(principal * (intRate / 100) * months).toFixed(2);
}

export async function getDocCharges(principal: number, rate: Tables['interest_rates']['Row']): Promise<number> {
    const {doc_charges: docCharges} = rate;
    if (rate.doc_charges_type === 'Fixed') {
        return docCharges;
    } else {
        return +(principal * (docCharges / 100)).toFixed(2);
    }
}