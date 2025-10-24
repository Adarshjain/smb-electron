import { useCallback, useEffect, useRef } from "react";

interface UseEnterNavigationOptions {
    fields: string[]; // ordered list of field "name" attributes
    onSubmit?: () => void; // optional submit callback
}

export function useEnterNavigation({ fields, onSubmit }: UseEnterNavigationOptions) {
    const formRef = useRef<HTMLFormElement>(null);

    const next = useCallback((shiftKey = false) => {
        const activeElement = document.activeElement as HTMLElement;
        
        // Only handle input/select/textarea elements
        if (
            !(activeElement instanceof HTMLInputElement ||
                activeElement instanceof HTMLTextAreaElement ||
                activeElement instanceof HTMLSelectElement)
        ) {
            return;
        }

        const fieldName = activeElement.getAttribute("name");
        if (!fieldName) return;

        const currentIndex = fields.indexOf(fieldName);
        if (currentIndex === -1) return;

        const nextIndex = shiftKey ? currentIndex - 1 : currentIndex + 1;

        const form = formRef.current;
        if (!form) return;

        if (nextIndex >= 0 && nextIndex < fields.length) {
            const nextName = fields[nextIndex];
            const nextField = form.querySelector<HTMLElement>(`[name="${nextName}"]`);
            nextField?.focus();
        } else {
            // When last field is reached, submit
            if (onSubmit) onSubmit();
            else form.requestSubmit?.();
        }
    }, [fields, onSubmit]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key !== "Enter") return;

        // Prevent default Enter submit
        e.preventDefault();

        next(e.shiftKey);
    }, [next]);

    const setFormRef = useCallback((element: HTMLFormElement | null) => {
        if (formRef.current) {
            formRef.current.removeEventListener("keydown", handleKeyDown);
        }
        formRef.current = element;
        if (element) {
            element.addEventListener("keydown", handleKeyDown);
        }
    }, [handleKeyDown]);

    useEffect(() => {
        return () => {
            if (formRef.current) {
                formRef.current.removeEventListener("keydown", handleKeyDown);
            }
        };
    }, [handleKeyDown]);

    return { setFormRef, next };
}
