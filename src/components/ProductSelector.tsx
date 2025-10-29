import { useEffect, useState } from 'react';
import SearchSelect from '@/components/SearchSelect.tsx';

export default function ProductSelector(props: {
  options: string[];
  value?: string;
  inputName?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  triggerWidth?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
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

  return (
    <SearchSelect
      options={filteredProducts}
      value={props.value}
      onSearchChange={setSearch}
      inputName={props.inputName}
      placeholder={props.placeholder}
      onChange={props.onChange}
      triggerWidth={props.triggerWidth}
      onKeyDown={props.onKeyDown}
      onFocus={props.onFocus}
    />
  );
}
