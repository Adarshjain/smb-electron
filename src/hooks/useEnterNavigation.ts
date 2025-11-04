import { useCallback, useEffect, useRef } from 'react';

interface UseEnterNavigationOptions<T> {
  fields: (T | string)[]; // ordered list of field "name" attributes
  onSubmit?: () => void; // optional submit callback
  submitField?: T | string;
}

export function useEnterNavigation<T = string>({
  fields,
  onSubmit,
  submitField,
}: UseEnterNavigationOptions<T>) {
  const formRef = useRef<HTMLFormElement>(null);

  const next = useCallback(
    (name?: T, shiftKey = false) => {
      const form = formRef.current;
      if (!form) return;
      if (name) {
        const nextField = form.querySelector<HTMLElement>(`[name="${name}"]`);
        nextField?.focus();
        return;
      }
      const activeElement = document.activeElement as HTMLElement;

      const fieldName = activeElement.getAttribute('name');
      if (!fieldName) return;

      if (fieldName === submitField) {
        if (onSubmit) onSubmit();
        else form.requestSubmit?.();
      }

      const currentIndex = fields.indexOf(fieldName);
      if (currentIndex === -1) return;

      const nextIndex = shiftKey ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex >= 0 && nextIndex < fields.length) {
        const nextName = fields[nextIndex];
        const nextField = form.querySelector<HTMLElement>(
          `[name="${nextName as string}"]`
        );
        nextField?.focus();
      } else {
        // When last field is reached, submit
        if (onSubmit) onSubmit();
        else form.requestSubmit?.();
      }
    },
    [fields, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;

      // Prevent default Enter submit
      e.preventDefault();

      next(undefined, e.shiftKey);
    },
    [next]
  );

  const setFormRef = useCallback(
    (element: HTMLFormElement | null) => {
      if (formRef.current) {
        formRef.current.removeEventListener('keydown', handleKeyDown);
      }
      formRef.current = element;
      if (element) {
        element.addEventListener('keydown', handleKeyDown);
      }
    },
    [handleKeyDown]
  );

  useEffect(() => {
    return () => {
      if (formRef.current) {
        formRef.current.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [handleKeyDown]);

  return { setFormRef, next };
}
