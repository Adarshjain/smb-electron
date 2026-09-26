import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { Bookmark, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from '@/components/DatePicker.tsx';
import { useCompany } from '@/context/CompanyProvider.tsx';
import { query } from '@/hooks/dbUtil.ts';
import { useDebounce } from '@/hooks/useDebounce.ts';
import {
  errorToast,
  getFinancialYearRange,
  viewableDate,
} from '@/lib/myUtils.tsx';
import {
  BRACKETS,
  countActiveFilters,
  DEFAULT_FILTERS,
  type AnalyticsFilters,
  type DateRange,
} from '@/lib/analytics/facts.ts';
import type { MetalType } from '../../../tables';
import MultiSelect, { type Option } from './MultiSelect.tsx';
import { count, rupees } from './format.ts';

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

type PeriodKey =
  | 'all'
  | 'fy'
  | 'lastfy'
  | '12m'
  | '6m'
  | '3m'
  | 'month'
  | 'custom';

function periodFor(key: PeriodKey, asOf: string): DateRange | null {
  const today = parseISO(asOf);
  switch (key) {
    case 'all':
      return null;
    case 'fy': {
      const [from, to] = getFinancialYearRange(today);
      return { from, to };
    }
    case 'lastfy': {
      const [from, to] = getFinancialYearRange(subMonths(today, 12));
      return { from, to };
    }
    case '12m':
    case '6m':
    case '3m':
      return {
        from: iso(addDays(subMonths(today, parseInt(key, 10)), 1)),
        to: asOf,
      };
    case 'month':
      return { from: iso(startOfMonth(today)), to: asOf };
    case 'custom':
      return { from: iso(subMonths(today, 12)), to: asOf };
  }
}

const PERIOD_LABELS: Record<PeriodKey, string> = {
  all: 'All time',
  fy: 'This financial year',
  lastfy: 'Last financial year',
  '12m': 'Last 12 months',
  '6m': 'Last 6 months',
  '3m': 'Last 3 months',
  month: 'This month',
  custom: 'Custom range',
};

function matchPeriod(period: DateRange | null, asOf: string): PeriodKey {
  if (!period) return 'all';
  const keys: PeriodKey[] = ['fy', 'lastfy', '12m', '6m', '3m', 'month'];
  return (
    keys.find((k) => {
      const p = periodFor(k, asOf);
      return p?.from === period.from && p.to === period.to;
    }) ?? 'custom'
  );
}

const METALS: Option<MetalType>[] = [
  { value: 'Gold', label: 'Gold' },
  { value: 'Silver', label: 'Silver' },
  { value: 'Other', label: 'Other' },
];

const PRESETS_KEY = 'analytics.presets';

function loadPresets(): Record<string, AnalyticsFilters> {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '{}') as Record<
      string,
      AnalyticsFilters
    >;
  } catch {
    return {};
  }
}

function NumberInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder: string;
  className?: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const debounced = useDebounce((v: string) => {
    const n = parseFloat(v);
    onChange(v.trim() === '' || Number.isNaN(n) ? null : n);
  }, 500);
  useEffect(() => setText(value === null ? '' : String(value)), [value]);
  return (
    <Input
      className={className ?? 'w-24 h-9'}
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        debounced(e.target.value);
      }}
    />
  );
}

export default function FilterBar({
  filters,
  onChange,
  asOf,
}: {
  filters: AnalyticsFilters;
  onChange: (filters: AnalyticsFilters) => void;
  asOf: string;
}) {
  const { allCompanies } = useCompany();
  const [rates, setRates] = useState<Option<number>[]>([]);
  const [areas, setAreas] = useState<Option<string>[]>([]);
  const [presets, setPresets] = useState(loadPresets);
  const [presetName, setPresetName] = useState('');
  const [customPeriod, setCustomPeriod] = useState(false);

  useEffect(() => {
    query<{ interest_rate: number; n: number }[]>(
      `SELECT interest_rate, COUNT(*) AS n FROM bills WHERE deleted IS NULL
       GROUP BY interest_rate ORDER BY interest_rate`
    )
      .then((rows) =>
        setRates(
          (rows ?? []).map((r) => ({
            value: r.interest_rate,
            label: `${r.interest_rate}%`,
            hint: count(r.n),
          }))
        )
      )
      .catch(errorToast);
    query<{ area: string; n: number }[]>(
      `SELECT c.area, COUNT(*) AS n FROM bills b
       JOIN customers c ON c.id = b.customer_id AND c.deleted IS NULL
       WHERE b.deleted IS NULL AND c.area IS NOT NULL
       GROUP BY c.area ORDER BY n DESC`
    )
      .then((rows) =>
        setAreas(
          (rows ?? []).map((r) => ({
            value: r.area,
            label: r.area,
            hint: count(r.n),
          }))
        )
      )
      .catch(errorToast);
  }, []);

  const periodKey = customPeriod ? 'custom' : matchPeriod(filters.period, asOf);
  const set = (patch: Partial<AnalyticsFilters>) =>
    onChange({ ...filters, ...patch });

  const bracketValue = useMemo(() => {
    const match = BRACKETS.find(
      (b) => b.min === filters.amountMin && b.max === filters.amountMax
    );
    if (match) return String(match.id);
    return filters.amountMin === null && filters.amountMax === null
      ? 'any'
      : 'custom';
  }, [filters.amountMin, filters.amountMax]);

  const chips = useMemo(() => {
    const out: { label: string; clear: Partial<AnalyticsFilters> }[] = [];
    if (filters.companies.length)
      out.push({
        label: filters.companies.join(', '),
        clear: { companies: [] },
      });
    if (filters.metals.length)
      out.push({ label: filters.metals.join(', '), clear: { metals: [] } });
    if (filters.status !== 'all')
      out.push({
        label: filters.status === 'open' ? 'Open loans' : 'Released loans',
        clear: { status: 'all' },
      });
    if (filters.amountMin !== null || filters.amountMax !== null)
      out.push({
        label: `Principal ${filters.amountMin !== null ? rupees(filters.amountMin) : '₹0'} – ${
          filters.amountMax !== null ? rupees(filters.amountMax) : 'any'
        }`,
        clear: { amountMin: null, amountMax: null },
      });
    if (filters.rates.length)
      out.push({
        label: `Rate ${filters.rates.join('%, ')}%`,
        clear: { rates: [] },
      });
    if (filters.areas.length)
      out.push({
        label:
          filters.areas.length > 2
            ? `${filters.areas.length} areas`
            : filters.areas.join(', '),
        clear: { areas: [] },
      });
    if (filters.customerType !== 'all')
      out.push({
        label:
          filters.customerType === 'new'
            ? "Customer's first loan"
            : 'Repeat customers',
        clear: { customerType: 'all' },
      });
    if (filters.repledge !== 'all')
      out.push({
        label:
          filters.repledge === 'repledge'
            ? 'Re-pledges only'
            : 'Excluding re-pledges',
        clear: { repledge: 'all' },
      });
    if (filters.monthsMin !== null || filters.monthsMax !== null)
      out.push({
        label: `Held ${filters.monthsMin ?? 0}–${filters.monthsMax ?? '∞'} extra months`,
        clear: { monthsMin: null, monthsMax: null },
      });
    if (filters.loanPeriod)
      out.push({
        label: `Loans taken ${viewableDate(filters.loanPeriod.from)} – ${viewableDate(filters.loanPeriod.to)}`,
        clear: { loanPeriod: null },
      });
    return out;
  }, [filters]);

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const next = { ...presets, [name]: filters };
    setPresets(next);
    setPresetName('');
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    } catch {
      /* presets are a convenience; ignore storage errors */
    }
  };

  const deletePreset = (name: string) => {
    const next = { ...presets };
    delete next[name];
    setPresets(next);
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const moreCount = [
    filters.rates.length > 0,
    filters.areas.length > 0,
    filters.customerType !== 'all',
    filters.repledge !== 'all',
    filters.monthsMin !== null || filters.monthsMax !== null,
    filters.loanPeriod !== null,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          value={periodKey}
          onChange={(e) => {
            const key = e.target.value as PeriodKey;
            setCustomPeriod(key === 'custom');
            set({
              period:
                key === 'custom'
                  ? (filters.period ?? periodFor('custom', asOf))
                  : periodFor(key, asOf),
            });
          }}
          aria-label="Period"
        >
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
            <NativeSelectOption key={k} value={k}>
              {PERIOD_LABELS[k]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {periodKey === 'custom' && filters.period ? (
          <div className="flex items-center gap-1">
            <DatePicker
              className="w-36"
              value={filters.period.from}
              onInputChange={(from) =>
                from && set({ period: { from, to: filters.period!.to } })
              }
            />
            –
            <DatePicker
              className="w-36"
              value={filters.period.to}
              onInputChange={(to) =>
                to && set({ period: { from: filters.period!.from, to } })
              }
            />
          </div>
        ) : null}
        <MultiSelect
          label="Company"
          options={allCompanies.map((c) => ({ value: c.name, label: c.name }))}
          selected={filters.companies}
          onChange={(companies) => set({ companies })}
        />
        <MultiSelect
          label="Metal"
          options={METALS}
          selected={filters.metals}
          onChange={(metals) => set({ metals })}
        />
        <NativeSelect
          value={filters.status}
          onChange={(e) =>
            set({ status: e.target.value as AnalyticsFilters['status'] })
          }
          aria-label="Loan status"
        >
          <NativeSelectOption value="all">Open & released</NativeSelectOption>
          <NativeSelectOption value="open">Open only</NativeSelectOption>
          <NativeSelectOption value="released">
            Released only
          </NativeSelectOption>
        </NativeSelect>
        <NativeSelect
          value={bracketValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'any') set({ amountMin: null, amountMax: null });
            else if (v !== 'custom') {
              const b = BRACKETS.find((x) => String(x.id) === v)!;
              set({ amountMin: b.min, amountMax: b.max });
            }
          }}
          aria-label="Principal"
        >
          <NativeSelectOption value="any">Any principal</NativeSelectOption>
          {BRACKETS.map((b) => (
            <NativeSelectOption key={b.id} value={String(b.id)}>
              {b.label}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value="custom">Custom…</NativeSelectOption>
        </NativeSelect>
        {bracketValue === 'custom' || bracketValue === 'any' ? (
          <div className="flex items-center gap-1">
            <NumberInput
              value={filters.amountMin}
              placeholder="Min ₹"
              onChange={(amountMin) => set({ amountMin })}
            />
            –
            <NumberInput
              value={filters.amountMax}
              placeholder="Max ₹"
              onChange={(amountMax) => set({ amountMax })}
            />
          </div>
        ) : null}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 border-input font-normal">
              <SlidersHorizontal />
              More filters
              {moreCount ? <Badge className="ml-1">{moreCount}</Badge> : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[420px] flex flex-col gap-3"
            align="start"
          >
            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
              <Label>Interest rate</Label>
              <MultiSelect
                label="Rate"
                options={rates}
                selected={filters.rates}
                onChange={(r) => set({ rates: r })}
              />
              <Label>Area</Label>
              <MultiSelect
                label="Area"
                options={areas}
                selected={filters.areas}
                onChange={(a) => set({ areas: a })}
                searchable
              />
              <Label>Customer</Label>
              <NativeSelect
                value={filters.customerType}
                onChange={(e) =>
                  set({
                    customerType: e.target
                      .value as AnalyticsFilters['customerType'],
                  })
                }
              >
                <NativeSelectOption value="all">Everyone</NativeSelectOption>
                <NativeSelectOption value="new">
                  Customer's first loan
                </NativeSelectOption>
                <NativeSelectOption value="repeat">
                  Repeat customers
                </NativeSelectOption>
              </NativeSelect>
              <Label>Re-pledge</Label>
              <NativeSelect
                value={filters.repledge}
                onChange={(e) =>
                  set({
                    repledge: e.target.value as AnalyticsFilters['repledge'],
                  })
                }
              >
                <NativeSelectOption value="all">All loans</NativeSelectOption>
                <NativeSelectOption value="repledge">
                  Only loans taken the day they released another
                </NativeSelectOption>
                <NativeSelectOption value="fresh">
                  Exclude those
                </NativeSelectOption>
              </NativeSelect>
              <Label>Extra months held</Label>
              <div className="flex items-center gap-1">
                <NumberInput
                  className="w-20 h-9"
                  value={filters.monthsMin}
                  placeholder="Min"
                  onChange={(monthsMin) => set({ monthsMin })}
                />
                –
                <NumberInput
                  className="w-20 h-9"
                  value={filters.monthsMax}
                  placeholder="Max"
                  onChange={(monthsMax) => set({ monthsMax })}
                />
              </div>
              <Label>Loans taken</Label>
              {filters.loanPeriod ? (
                <div className="flex items-center gap-1">
                  <DatePicker
                    className="w-34"
                    value={filters.loanPeriod.from}
                    onInputChange={(from) =>
                      from &&
                      set({ loanPeriod: { from, to: filters.loanPeriod!.to } })
                    }
                  />
                  –
                  <DatePicker
                    className="w-34"
                    value={filters.loanPeriod.to}
                    onInputChange={(to) =>
                      to &&
                      set({
                        loanPeriod: { from: filters.loanPeriod!.from, to },
                      })
                    }
                  />
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="h-9 border-input font-normal w-fit"
                  onClick={() => set({ loanPeriod: periodFor('fy', asOf) })}
                >
                  Any date · set range
                </Button>
              )}
            </div>
            <p className="text-xs text-[#898781]">
              "Extra months" counts months charged on top of the first month,
              the same way Release Loan does.
            </p>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 border-input font-normal">
              <Bookmark />
              Saved views
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[280px] flex flex-col gap-2"
            align="start"
          >
            {Object.keys(presets).length === 0 ? (
              <p className="text-xs text-[#898781]">No saved views yet.</p>
            ) : (
              Object.entries(presets).map(([name, preset]) => (
                <div key={name} className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex-1 text-left text-sm px-2 py-1 rounded hover:bg-accent cursor-pointer truncate"
                    onClick={() => onChange({ ...DEFAULT_FILTERS, ...preset })}
                  >
                    {name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${name}`}
                    className="p-1 text-[#898781] hover:text-[#0b0b0b] cursor-pointer"
                    onClick={() => deletePreset(name)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
            <div className="flex gap-1 border-t pt-2">
              <Input
                className="h-8"
                placeholder="Name this view"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && savePreset()}
              />
              <Button
                className="h-8"
                onClick={savePreset}
                disabled={!presetName.trim()}
              >
                Save
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {countActiveFilters(filters) || filters.period ? (
          <Button
            variant="ghost"
            className="h-9 font-normal text-[#52514e]"
            onClick={() => {
              setCustomPeriod(false);
              onChange(DEFAULT_FILTERS);
            }}
          >
            <RotateCcw />
            Reset
          </Button>
        ) : null}
      </div>
      {chips.length ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Badge
              key={chip.label}
              variant="outline"
              className="gap-1 pr-1 bg-white text-[#52514e]"
            >
              {chip.label}
              <button
                type="button"
                aria-label={`Remove ${chip.label}`}
                className="rounded-full hover:bg-accent p-0.5 cursor-pointer"
                onClick={() => set(chip.clear)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
