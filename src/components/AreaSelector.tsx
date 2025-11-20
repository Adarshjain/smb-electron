import { useEffect, useState } from 'react';
import SearchSelect from '@/components/SearchSelect.tsx';
import type { Tables } from '../../tables';

export default function AreaSelector(props: {
  options: Tables['areas'][];
  value?: Tables['areas'];
  inputName?: string;
  placeholder?: string;
  onChange?: (value: Tables['areas']) => void;
  triggerWidth?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filteredArea, setFilteredArea] = useState<Tables['areas'][]>([]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredArea([]);
      return;
    }
    const productNames = [
      ...new Set([
        ...props.options.filter((item) =>
          item.name.toLowerCase().startsWith(search.toLowerCase())
        ),
        ...props.options.filter((item) =>
          item.name.toLowerCase().includes(search.toLowerCase())
        ),
      ]),
    ];
    setFilteredArea(productNames);
  }, [props.options, search]);

  return (
    <SearchSelect<Tables['areas']>
      options={filteredArea}
      value={props.value}
      onSearchChange={setSearch}
      inputName={props.inputName}
      placeholder={props.placeholder}
      onChange={props.onChange}
      triggerWidth={props.triggerWidth}
      onKeyDown={props.onKeyDown}
      onFocus={props.onFocus}
      autoFocus={props.autoFocus}
      popoverWidth="w-[700px]"
      renderRow={(area: Tables['areas']) => {
        return (
          <div className="w-full">
            <div className="inline-block w-1/3">{area.name}</div>
            <div className="inline-block w-1/3">{area.post}</div>
            <div className="inline-block w-1/3">{area.town}</div>
          </div>
        );
      }}
    />
  );
}
