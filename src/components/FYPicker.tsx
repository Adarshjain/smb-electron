import { useEffect, useState } from 'react';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { getFinancialYearRange } from '@/lib/myUtils.tsx';

const years: number[] = [];
for (let i = 2020; i < new Date().getFullYear() + 1; i++) {
  years.push(i);
}

export default function FYPicker(props: {
  onChange?: (date: [string, string]) => void;
}) {
  const [year, setYear] = useState<number>(new Date().getFullYear() - 1);

  useEffect(() => {
    props.onChange?.(getFinancialYearRange(year));
  }, [year, props]);

  return (
    <NativeSelect
      value={year}
      onChange={(e) => setYear(parseInt(e.target.value))}
    >
      {years.map((year) => (
        <NativeSelectOption key={year} value={year}>
          FY {year}-{year + 1}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
