import { memo, useCallback, useEffect, useRef, useState } from 'react';
import AutocompleteSelect from './AutocompleteSelect';
import { query } from '@/hooks/dbUtil';
import type { LocalTables } from '@/../tables';

interface CustomerPickerProps {
  onSelect?: (value: LocalTables<'customers'>) => void;
  placeholder?: string;
  inputClassName?: string;
  autofocus?: boolean;
  showShortcut?: string;
}

// Memoized row renderer to prevent re-renders
const CustomerRow = memo(function CustomerRow({
  customer,
}: {
  customer: LocalTables<'customers'>;
}) {
  return (
    <>
      <div style={{ width: 160 }}>{customer.name}</div>
      <div style={{ width: 30 }}>{customer.fhtitle}</div>
      <div style={{ width: 160 }}>{customer.fhname}</div>
      <div style={{ width: 200 }}>{customer.area}</div>
    </>
  );
});

export default memo(function CustomerPicker({
  onSelect,
  placeholder = 'Customer',
  inputClassName,
  autofocus = false,
  showShortcut,
}: CustomerPickerProps) {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<LocalTables<'customers'>[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // Cleanup debounce on unmount
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (search.length === 0) {
      setCustomers([]);
      return;
    }

    // Debounce the search
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      let active = true;

      const run = async () => {
        // Use parameterized query to prevent SQL injection and allow caching
        const results = await query<LocalTables<'customers'>[]>(
          `SELECT * FROM customers WHERE name LIKE ? AND deleted IS NULL ORDER BY name, area LIMIT 50`,
          [`${search}%`]
        );
        if (active) setCustomers(results ?? []);
      };

      void run();

      return () => {
        active = false;
      };
    }, 100); // 100ms debounce
  }, [search]);

  const getDisplayValue = useCallback(
    (customer: LocalTables<'customers'>) => customer.name,
    []
  );
  const getKey = useCallback(
    (customer: LocalTables<'customers'>) => customer.id,
    []
  );
  const renderRow = useCallback(
    (customer: LocalTables<'customers'>) => <CustomerRow customer={customer} />,
    []
  );

  return (
    <AutocompleteSelect<LocalTables<'customers'>>
      options={customers}
      onSelect={onSelect}
      onSearchChange={setSearch}
      placeholder={placeholder}
      inputClassName={inputClassName}
      inputName="customer_picker"
      autofocus={autofocus}
      showShortcut={showShortcut}
      getDisplayValue={getDisplayValue}
      getKey={getKey}
      renderRow={renderRow}
      autoConvert
    />
  );
});
