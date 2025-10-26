import { memo } from 'react';
import { type Control, Controller } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Loan } from '@/types/loanForm';
import type { MetalType } from '@/../tables';
import { FIELD_WIDTHS } from '@/constants/loanForm';

interface MetalTypeSelectorProps {
  control: Control<Loan>;
  onMetalTypeChange: (metalType: MetalType) => void;
}

export const MetalTypeSelector = memo(function MetalTypeSelector({
  control,
  onMetalTypeChange,
}: MetalTypeSelectorProps) {
  return (
    <Controller
      name="metal_type"
      control={control}
      render={({ field }) => (
        <Select
          onValueChange={(value: string) => {
            const metalType = value as MetalType;
            field.onChange(metalType);
            onMetalTypeChange(metalType);
          }}
          value={field.value}
        >
          <SelectTrigger
            name="metal_type"
            className={FIELD_WIDTHS.METAL_TYPE_SELECT}
          >
            <SelectValue placeholder="Metal Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Gold">Gold</SelectItem>
            <SelectItem value="Silver">Silver</SelectItem>
          </SelectContent>
        </Select>
      )}
    />
  );
});
