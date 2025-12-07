import { useEffect, useState } from 'react';
import AutocompleteSelect from '@/components/AutocompleteSelect.tsx';

export default function ProductSelector(props: {
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
}) {
  const [search, setSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<string[]>([]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredProducts([]);
      return;
    }
    const productNames = [
      ...new Set([
        ...props.options.filter((item) =>
          item.toLowerCase().startsWith(search.toLowerCase())
        ),
        ...props.options.filter((item) =>
          item.toLowerCase().includes(search.toLowerCase())
        ),
      ]),
    ];
    setFilteredProducts(productNames);
  }, [props.options, search]);

  const onSearchChange = (value: string) => {
    props.onChange?.(value);
    setSearch(value);
  };

  return (
    <AutocompleteSelect<string>
      options={filteredProducts}
      onSelect={props.onChange}
      onSearchChange={onSearchChange}
      placeholder={props.placeholder}
      autofocus={props.autoFocus}
      inputClassName={props.inputClassName}
      triggerWidth={props.triggerWidth}
      inputName={props.inputName}
      autoConvert={props.autoConvert}
      value={props.value}
    />
  );
}
