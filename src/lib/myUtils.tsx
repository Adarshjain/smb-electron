import {toast} from "sonner";
import {format} from "date-fns";
import type {ElectronToReactResponse} from "../../shared-types";

export const mapToRegex = (map: Record<string, string>) => {
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

export function log(...args: any[]) {
    const blueLabel =
        "color: white; background-color: #007bff; padding: 2px 4px; border-radius: 2px; font-weight: bold;";
    // const greenLabel =
    //     "color: white; background-color: #28a745; padding: 2px 4px; border-radius: 2px; font-weight: bold;";
    const resetStyle = ""; // An empty string resets the style
    const first = args.shift();

    console.log(`%c${first}%c`, blueLabel, resetStyle, ...args);
}

export const rpcError = (response: { success: false; error: string; stack: string | undefined }) => {
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