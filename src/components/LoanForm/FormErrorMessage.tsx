import { memo } from 'react';

interface FormErrorMessageProps {
  message?: string;
}

export const FormErrorMessage = memo(function FormErrorMessage({
  message,
}: FormErrorMessageProps) {
  if (!message) return null;

  return (
    <p className="text-sm text-red-500 mt-1" role="alert">
      {message}
    </p>
  );
});

