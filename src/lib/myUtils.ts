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
