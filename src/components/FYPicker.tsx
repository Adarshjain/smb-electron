import { useEffect, useState } from 'react';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { getFinancialYearRange } from '@/lib/myUtils.tsx';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import DatePicker from '@/components/DatePicker.tsx';

const years: number[] = [];
for (let i = 2020; i < new Date().getFullYear() + 1; i++) {
  years.push(i);
}

export default function FYPicker(props: {
  onChange?: (date: [string, string]) => void;
}) {
  const [year, setYear] = useState<number>(new Date().getFullYear() - 1);
  const [useDatePicker, setuseDatePicker] = useState(false);

  useEffect(() => {
    props.onChange?.(getFinancialYearRange(year));
  }, [year, props]);

  return (
    <div className="flex gap-4">
      {useDatePicker ? (
        <div>
          <DatePicker />
        </div>
      ) : (
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
      )}
      <div className="flex gap-1 items-center">
        <Checkbox
          id="use_date_picker"
          checked={useDatePicker}
          onCheckedChange={(e) => setuseDatePicker(!!e)}
        />
        <Label htmlFor="use_date_picker">Date Picker</Label>
      </div>
    </div>
  );
}
