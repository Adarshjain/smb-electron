import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCompany } from '../context/CompanyProvider.tsx';
import { cn } from '@/lib/utils.ts';
import { Kbd } from '@/components/ui/kbd';

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
        className={cn('w-full cursor-pointer bg-white', props.className)}
      >
        <Kbd id="company-switcher">F1</Kbd>
        <SelectValue placeholder="Select Company" />
      </SelectTrigger>
      <SelectContent className="bg-gray-600 text-white">
        {allCompanies.map((comp) => (
          <SelectItem key={comp.name} value={comp.name}>
            {comp.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
