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
  year?: number;
  range?: [string, string];
}) {
  const [date, setDate] = useState<Date>(new Date());
  const [startDate, setStartDate] = useState(
    props.range ? props.range[0] : getFinancialYearRange(date)[0]
  );
  const [endDate, setEndDate] = useState(
    props.range ? props.range[1] : getFinancialYearRange(date)[1]
  );
  const [useDatePicker, setUseDatePicker] = useState<boolean>(
    props.range !== undefined
  );

  useEffect(() => {
    if (props.year) {
      setDate(new Date(props.year, 3, 1));
      setUseDatePicker(false);
    }
    if (props.range) {
      setStartDate(props.range[0]);
      setEndDate(props.range[1]);
      setUseDatePicker(true);
    }
  }, [props.range, props.year]);

  useEffect(() => {
    if (!useDatePicker) {
      const [start, end] = getFinancialYearRange(date);
      setStartDate(start);
      setEndDate(end);
      props.onChange?.([start, end]);
    }
  }, [date, props, useDatePicker]);

  useEffect(() => {
    if (useDatePicker) {
      props.onChange?.([startDate, endDate]);
    }
  }, [endDate, props, startDate, useDatePicker]);

  return (
    <div className="flex gap-4">
      {useDatePicker ? (
        <div className="flex gap-2 items-center">
          <DatePicker value={startDate} onInputChange={setStartDate} /> -
          <DatePicker value={endDate} onInputChange={setEndDate} />
        </div>
      ) : (
        <NativeSelect
          value={new Date(startDate).getFullYear()}
          onChange={(e) => setDate(new Date(parseInt(e.target.value), 3, 1))}
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
          onCheckedChange={(e) => setUseDatePicker(!!e)}
        />
        <Label htmlFor="use_date_picker">Date Picker</Label>
      </div>
    </div>
  );
}
