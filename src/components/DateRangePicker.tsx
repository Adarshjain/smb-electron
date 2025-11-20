import DatePicker from '@/components/DatePicker.tsx';
import { useEffect, useState } from 'react';
import { getFinancialYearRange } from '@/lib/myUtils.tsx';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function DateRangePicker(props: {
  onChange?: (date: [string, string]) => void;
}) {
  const [fyStart, fyEnd] = getFinancialYearRange(2020);
  const [startDate, setStartDate] = useState(fyStart);
  const [endDate, setEndDate] = useState(fyEnd);

  const setFyDates = () => {
    const [start, end] = getFinancialYearRange(2020);
    setStartDate(start);
    setEndDate(end);
  };

  useEffect(() => {
    props.onChange?.([startDate, endDate]);
  }, [endDate, props, startDate]);

  return (
    <div className="flex gap-4 justify-center items-center">
      <div className="flex flex-col gap-1">
        <Label>Start Date</Label>
        <DatePicker
          className="w-27.5"
          value={startDate}
          onInputChange={setStartDate}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label>End Date</Label>
        <DatePicker
          className="w-27.5"
          value={endDate}
          onInputChange={setEndDate}
        />
      </div>
      <Button variant="outline" className="w-25" onClick={() => setFyDates()}>
        Current FY
      </Button>
      <Button variant="outline" className="w-25" onClick={() => setFyDates()}>
        Prev FY
      </Button>
    </div>
  );
}
