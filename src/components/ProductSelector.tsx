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
    <>
      <AutocompleteSelect<string>
        options={filteredProducts}
        onSelect={props.onChange}
        onSearchChange={setSearch}
        placeholder={props.placeholder}
        autofocus={props.autoFocus}
        inputClassName={props.inputClassName}
        triggerWidth={props.triggerWidth}
        inputName={props.inputName}
      />
      {/*<SearchSelect*/}
      {/*  options={filteredProducts}*/}
      {/*  value={props.value}*/}
      {/*  onSearchChange={setSearch}*/}
      {/*  placeholder={props.placeholder}*/}
      {/*  onChange={props.onChange}*/}
      {/*  triggerWidth={props.triggerWidth}*/}
      {/*  popoverWidth={props.popoverWidth}*/}
      {/*  onKeyDown={props.onKeyDown}*/}
      {/*  onFocus={props.onFocus}*/}
      {/*  autoFocus={props.autoFocus}*/}
      {/*/>*/}
    </>
  );
}
