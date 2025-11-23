import { useEffect, useState } from 'react';
import AutocompleteSelect from './AutocompleteSelect';
import { query } from '@/hooks/dbUtil';
import type { Tables } from '@/../tables';

interface CustomerPickerProps {
  onSelect?: (value: Tables['customers']) => void;
  placeholder?: string;
  inputClassName?: string;
  autofocus?: boolean;
  showShortcut?: string;
}

/**
 * Backward-compatible CustomerPicker component.
 * This wraps the generic AutocompleteSelect with customer-specific logic.
 */
export default function CustomerPicker({
  onSelect,
  placeholder = 'Customer',
  inputClassName,
  autofocus = false,
  showShortcut,
}: CustomerPickerProps) {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Tables['customers'][]>([]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const results = await query<Tables['customers'][]>(
        `select * from customers where name LIKE '${search}%' order by name, area`
      );
      if (active) setCustomers(results ?? []);
    };

    if (search.length === 0) {
      setCustomers([]);
      return;
    }

    void run();

    return () => {
      active = false;
    };
  }, [search]);

  return (
    <AutocompleteSelect<Tables['customers']>
      options={customers}
      onSelect={onSelect}
      onSearchChange={setSearch}
      placeholder={placeholder}
      inputClassName={inputClassName}
      inputName="customer_picker"
      autofocus={autofocus}
      showShortcut={showShortcut}
      getDisplayValue={(customer) => customer.name}
      getKey={(customer) => customer.id}
      renderRow={(customer) => (
        <>
          <div style={{ width: 160 }}>{customer.name}</div>
          <div style={{ width: 30 }}>{customer.fhtitle}</div>
          <div style={{ width: 160 }}>{customer.fhname}</div>
          <div style={{ width: 200 }}>{customer.area}</div>
        </>
      )}
      autoConvert
    />
  );
}
