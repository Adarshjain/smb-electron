import { useEffect, useRef } from "react";

interface UseEnterNavigationOptions {
    fields: string[]; // ordered list of field "name" attributes
    onSubmit?: () => void; // optional submit callback
}

export function useEnterNavigation({ fields, onSubmit }: UseEnterNavigationOptions) {
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        const form = formRef.current;
        if (!form) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Enter") return;

            const target = e.target as HTMLElement;

            // Only handle input/select/textarea elements
            if (
                !(target instanceof HTMLInputElement ||
                    target instanceof HTMLTextAreaElement ||
                    target instanceof HTMLSelectElement)
            ) {
                return;
            }

            const fieldName = target.getAttribute("name");
            if (!fieldName) return;

            // Prevent default Enter submit
            e.preventDefault();

            const currentIndex = fields.indexOf(fieldName);
            if (currentIndex === -1) return;

            const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;

            if (nextIndex >= 0 && nextIndex < fields.length) {
                const nextName = fields[nextIndex];
                const nextField = form.querySelector<HTMLElement>(`[name="${nextName}"]`);
                nextField?.focus();
            } else {
                // When last field is reached, submit
                if (onSubmit) onSubmit();
                else form.requestSubmit?.();
            }
        };

        form.addEventListener("keydown", handleKeyDown);
        return () => form.removeEventListener("keydown", handleKeyDown);
    }, [fields, onSubmit]);

    return formRef;
}
