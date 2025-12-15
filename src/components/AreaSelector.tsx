import { useEffect, useState } from 'react';
import type { Tables } from '../../tables';
import AutocompleteSelect from '@/components/AutocompleteSelect.tsx';

export default function AreaSelector(props: {
  options: Tables['areas'][];
  value?: Tables['areas'];
  inputName?: string;
  placeholder?: string;
  onChange?: (value: Tables['areas']) => void;
  triggerWidth?: string;
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
    <AutocompleteSelect<Tables['areas']>
      options={filteredArea}
      value={props.value}
      onSearchChange={setSearch}
      inputName={props.inputName}
      placeholder={props.placeholder}
      onSelect={props.onChange}
      triggerWidth={props.triggerWidth}
      autofocus={props.autoFocus}
      dropdownWidth="w-[700px]"
      renderRow={(area: Tables['areas']) => {
        return (
          <div className="w-full">
            <div className="inline-block w-1/3">{area.name}</div>
            <div className="inline-block w-1/3">{area.post}</div>
            <div className="inline-block w-1/3">{area.town}</div>
          </div>
        );
      }}
      autoConvert
    />
  );
}
