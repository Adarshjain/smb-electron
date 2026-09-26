import { useState, type ReactNode } from 'react';
import { Table2, ChartColumn } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';

export interface TableView {
  columns: string[];
  rows: (string | number)[][];
}

/**
 * A titled panel for one chart. Every chart can flip to a plain table of the
 * same numbers (handy for reading exact values or copying them out).
 */
export function ChartCard({
  title,
  subtitle,
  children,
  table,
  actions,
  footer,
  loading,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  table?: TableView;
  actions?: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section
      className={cn(
        'rounded-xl border border-black/10 bg-[#fcfcfb] p-4 flex flex-col gap-2 min-w-0',
        className
      )}
    >
      <header className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#0b0b0b]">{title}</h3>
          {subtitle ? (
            <p className="text-xs text-[#52514e] mt-0.5">{subtitle}</p>
          ) : null}
        </div>
        {actions}
        {table ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setShowTable((v) => !v)}
                className="text-[#898781] hover:text-[#0b0b0b] p-1 rounded-md hover:bg-accent cursor-pointer"
                aria-label={showTable ? 'Show chart' : 'Show table'}
              >
                {showTable ? <ChartColumn size={16} /> : <Table2 size={16} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="px-2 py-1 text-xs">
              {showTable ? 'Show chart' : 'Show table'}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </header>
      <div
        className={cn(
          'transition-opacity min-w-0',
          loading ? 'opacity-50' : 'opacity-100'
        )}
      >
        {showTable && table ? (
          <div className="max-h-[320px] overflow-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  {table.columns.map((c) => (
                    <TableHead key={c} className="h-7">
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((row, i) => (
                  <TableRow key={i}>
                    {row.map((cell, j) => (
                      <TableCell
                        key={j}
                        className={cn(
                          'py-1 tabular-nums',
                          typeof cell === 'number' ? 'text-right' : ''
                        )}
                      >
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          children
        )}
      </div>
      {footer ? <div className="text-xs text-[#52514e]">{footer}</div> : null}
    </section>
  );
}

/** A headline number. */
export function StatTile({
  label,
  value,
  detail,
  onClick,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        'rounded-xl border border-black/10 bg-[#fcfcfb] px-4 py-3 text-left min-w-0',
        onClick ? 'cursor-pointer hover:border-black/25' : 'cursor-default'
      )}
    >
      <div className="text-xs text-[#52514e]">{label}</div>
      <div className="text-xl font-semibold text-[#0b0b0b] mt-1 truncate">
        {value}
      </div>
      {detail ? (
        <div className="text-xs text-[#898781] mt-0.5 truncate">{detail}</div>
      ) : null}
    </button>
  );
}

/** A plain-language finding pulled out of the numbers. */
export function Insight({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg bg-[#eef4fc] border border-[#cde2fb] px-3 py-2 text-xs text-[#0d366b]">
      {children}
    </div>
  );
}
