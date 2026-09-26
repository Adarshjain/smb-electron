import { useMemo, useState } from 'react';
import AutocompleteSelect from '@/components/AutocompleteSelect.tsx';
import { filterIdProofTypes } from '@/constants/idProof.ts';

export default function IdProofSelector(props: {
  value?: string;
  inputName?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  triggerWidth?: string;
}) {
  const [search, setSearch] = useState('');
  const filteredTypes = useMemo(() => filterIdProofTypes(search), [search]);

  return (
    <AutocompleteSelect<string>
      options={filteredTypes}
      value={props.value}
      onSearchChange={setSearch}
      inputName={props.inputName}
      placeholder={props.placeholder}
      onSelect={props.onChange}
      triggerWidth={props.triggerWidth}
      dropdownWidth={props.triggerWidth}
      // ID proof types are English; Tamil conversion would break matching
      autoConvert={false}
    />
  );
}
