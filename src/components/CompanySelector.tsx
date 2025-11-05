import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCompany } from '../context/CompanyProvider.tsx';
import { cn } from '@/lib/utils.ts';

export default function CompanySelector(props: {
  className?: string;
  disabled?: boolean;
}) {
  const { company, setCompany, allCompanies } = useCompany();
  return (
    <Select
      onValueChange={(value: string) => {
        const selectedCompany =
          allCompanies.find((comp) => comp.name === value) ?? null;
        if (selectedCompany) {
          setCompany(selectedCompany);
        }
      }}
      value={company?.name ?? ''}
      disabled={props.disabled}
    >
      <SelectTrigger
        className={cn('w-full', props.className)}
        name="company-switcher"
      >
        <SelectValue placeholder="Select Company" />
      </SelectTrigger>
      <SelectContent>
        {allCompanies.map((comp) => (
          <SelectItem key={comp.name} value={comp.name}>
            {comp.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
