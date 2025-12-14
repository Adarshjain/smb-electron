import { memo, useCallback, useMemo, useState } from 'react';
import AutocompleteSelect from '@/components/AutocompleteSelect.tsx';

interface ProductSelectorProps {
  options: string[];
  value?: string;
  inputName?: string;
  inputClassName?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  triggerWidth?: string;
  popoverWidth?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  autoConvert: boolean;
  allowTempValues?: boolean;
}

export default memo(function ProductSelector({
  options,
  value,
  inputName,
  inputClassName,
  placeholder,
  onChange,
  triggerWidth,
  autoFocus,
  autoConvert,
  allowTempValues = false,
}: ProductSelectorProps) {
  const [search, setSearch] = useState('');

  // Memoize filtered products to prevent recalculation
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return [];

    const searchLower = search.toLowerCase();
    const startsWithMatches: string[] = [];
    const containsMatches: string[] = [];

    for (const item of options) {
      const itemLower = item.toLowerCase();
      if (itemLower.startsWith(searchLower)) {
        startsWithMatches.push(item);
      } else if (itemLower.includes(searchLower)) {
        containsMatches.push(item);
      }
    }

    // Combine and dedupe
    return [...new Set([...startsWithMatches, ...containsMatches])];
  }, [options, search]);

  const onSearchChange = useCallback(
    (value: string) => {
      if (allowTempValues) {
        onChange?.(value);
      }
      setSearch(value);
    },
    [allowTempValues, onChange]
  );

  return (
    <AutocompleteSelect<string>
      options={filteredProducts}
      onSelect={onChange}
      onSearchChange={onSearchChange}
      placeholder={placeholder}
      autofocus={autoFocus}
      inputClassName={inputClassName}
      triggerWidth={triggerWidth}
      inputName={inputName}
      autoConvert={autoConvert}
      value={value}
      allowTempValues={allowTempValues}
    />
  );
});
