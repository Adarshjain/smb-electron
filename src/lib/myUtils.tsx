import { toast } from 'sonner';
import {
  addMonths,
  differenceInMonths,
  format,
  isBefore,
  startOfDay,
  subDays,
} from 'date-fns';
import type { ElectronToReactResponse } from '../../shared-types';
import type { FullCustomer, MetalType, Tables } from '../../tables';
import MyCache from '../../MyCache.ts';
import { read } from '@/hooks/dbUtil.ts';
import { toastStyles } from '@/constants/loanForm.ts';
import { cn } from '@/lib/utils.ts';

export function mapToRegex(map: Record<string, string>) {
  return new RegExp(
    Object.keys(map)
      .sort((a, b) => {
        if (b.length === a.length) return a.localeCompare(b);
        return b.length - a.length;
      })
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|'),
    'g'
  );
}

export function rpcError(response: {
  success: false;
  error: string;
  stack: string | undefined;
}) {
  toast.error(`Error: ${response.error}`, {
    description: (
      <pre className="bg-code text-code-foreground mt-2 w-[320px] overflow-x-auto rounded-md p-4">
        <code>{response.stack}</code>
      </pre>
    ),
    classNames: { content: cn('flex flex-col gap-2', toastStyles.error) },
    style: {
      '--border-radius': 'calc(var(--radius) + 4px)',
    } as React.CSSProperties,
  });
}

export function viewableDate(dateStr?: string | Date): string {
  return format(dateStr ? new Date(dateStr) : new Date(), 'dd/MM/yyyy');
}

export function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function currentIsoDate() {
  return new Date().toISOString().split('T')[0];
}

export function nextIsoDate(dateStr?: string): string {
  const date = new Date(dateStr ?? currentIsoDate());
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

export function previousIsoDate(dateStr?: string): string {
  const date = new Date(dateStr ?? currentIsoDate());
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

export function isValidIsoDate(dateStr: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return isoDateRegex.test(dateStr);
}

export function formatCurrency(value: number, skipSymbol = false): string {
  return new Intl.NumberFormat(
    'en-IN',
    skipSymbol
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { style: 'currency', currency: 'INR' }
  ).format(value);
}

export function successToast(msg: string) {
  toast.success(msg, { className: toastStyles.success });
}
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export function errorToast(msg: string | Error | unknown) {
  if (msg instanceof Error) {
    rpcError({
      success: false,
      error: msg.message,
      stack: msg.cause as string,
    });
  } else {
    toast.error(msg as string, { className: toastStyles.error });
  }
}

export function toastElectronResponse<T>(
  response: ElectronToReactResponse<T>,
  successMessage = 'Success',
  onlyError = false
): boolean {
  if (!response.success) {
    if (response.error === 'UNIQUE constraint failed') {
      toast.error('Already exists!', { className: toastStyles.error });
    } else {
      rpcError(response);
    }
    return false;
  }
  if (!onlyError) {
    toast.success(successMessage, { className: toastStyles.success });
  }
  return true;
}

export async function getRate(
  principal: number,
  metalType: MetalType
): Promise<Tables['interest_rates']['Row'] | undefined> {
  const cache = new MyCache<Tables['interest_rates']['Row'][]>('IntRates');
  let intRates = cache.get('intRates');
  if (!intRates) {
    try {
      const interestRates = await read('interest_rates', {});
      cache.set('intRates', interestRates ?? []);
      intRates = interestRates ?? [];
    } catch (e) {
      errorToast(e);
    }
  }
  return intRates?.find((rate) => {
    if (rate.metal_type === metalType) {
      if (principal >= rate.from_ && principal <= rate.to_) {
        return rate;
      }
    }
  });
}

export function getInterest(principal: number, intRate: number, months = 1) {
  return Math.round(+(principal * (intRate / 100) * months).toFixed(2));
}

export function getMonthDiff(from: string, to?: string) {
  const now = to ? new Date(to) : new Date();
  const start = new Date(from);
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  return start.getDate() === now.getDate() ? months - 1 : months;
}

export function getTaxedMonthDiff(from: string | Date, to?: string | Date) {
  const start = new Date(from);
  const end = adjustEndDate(start, to ? new Date(to) : new Date(), 0);
  return monthDiffRoundedUp(start, end);
}

export function monthDiffRoundedUp(startDate: Date, endDate: Date): number {
  let diff = differenceInMonths(endDate, startDate);

  const dateAfterDiff = addMonths(startDate, diff);

  if (isBefore(dateAfterDiff, endDate)) {
    diff += 1; // round up
  }

  return diff;
}

export function adjustEndDate(startDate: Date, endDate: Date, n: number): Date {
  startDate = startDate ? new Date(startDate) : new Date();
  endDate = new Date(endDate);

  const start = startOfDay(startDate);
  let end = startOfDay(endDate);

  if (isBefore(end, start)) {
    end = subDays(end, n);
    if (isBefore(end, start)) {
      end = start;
    }
  }

  return end;
}

export function getDocCharges(
  principal: number,
  rate: Tables['interest_rates']['Row']
): number {
  const { doc_charges: docCharges } = rate;
  if (rate.rate === 2 && principal === 5000) {
    return 30;
  }
  if (rate.doc_charges_type === 'Fixed') {
    return docCharges;
  } else {
    return +(principal * (docCharges / 100)).toFixed(2);
  }
}

export async function loadBillWithDeps(
  serial: string,
  loanNo: number
): Promise<Tables['full_bill']['Row'] | null> {
  try {
    const loan = await read('bills', {
      serial: serial.toUpperCase(),
      loan_no: loanNo,
    });
    if (!loan?.length) {
      toast.error('No loan found with given Serial and Loan Number', {
        className: toastStyles.error,
      });
      return null;
    }
    const currentLoan = loan[0];

    const fullCustomer = await fetchFullCustomer(currentLoan.customer_id);
    if (!fullCustomer) {
      toast.error('No fullCustomer match', { className: toastStyles.error });
      return null;
    }

    const billItems = await read('bill_items', {
      serial: serial.toUpperCase(),
      loan_no: loanNo,
    });
    if (!billItems?.length) {
      toast.error('No items match', { className: toastStyles.error });
      return null;
    }

    return {
      ...currentLoan,
      full_customer: fullCustomer,
      bill_items: billItems,
    };
  } catch (e) {
    errorToast(e);
    return null;
  }
}

export async function fetchFullCustomer(
  customerId: string
): Promise<FullCustomer | null> {
  try {
    const customers = await read('customers', {
      id: customerId,
    });
    if (!customers?.length) {
      toast.error('No customerPromise match', { className: toastStyles.error });
      return null;
    }
    const customer = customers[0];
    const areas = await read('areas', {
      name: customer.area,
    });
    if (!areas?.length) {
      toast.error('No area match', { className: toastStyles.error });
      return null;
    }
    return {
      customer: customer,
      area: areas[0],
    };
  } catch (e) {
    errorToast(e);
    return null;
  }
}

export async function fetchBillsByCustomer(
  customerId: string,
  skipReleased = true
): Promise<Tables['full_bill']['Row'][] | undefined> {
  const billsResponse = await read(
    'bills',
    skipReleased
      ? {
          customer_id: customerId,
          released: 0,
        }
      : {
          customer_id: customerId,
        }
  );
  const fullCustomer = await fetchFullCustomer(customerId);
  if (fullCustomer && billsResponse?.length) {
    const fullBills: Tables['full_bill']['Row'][] = [];
    for (const bill of billsResponse) {
      try {
        const billItemsResponse = await read('bill_items', {
          serial: bill.serial,
          loan_no: bill.loan_no,
        });
        let release: Tables['releases']['Row'] | undefined;
        if (!skipReleased && bill.released === 1) {
          const releaseResponse = await read('releases', {
            serial: bill.serial,
            loan_no: bill.loan_no,
          });
          if (releaseResponse?.length) {
            release = releaseResponse[0];
          }
        }
        if (billItemsResponse?.length) {
          fullBills.push({
            ...bill,
            full_customer: fullCustomer,
            bill_items: billItemsResponse,
            releasedEntry: release,
          });
        }
      } catch (e) {
        errorToast(e);
      }
    }
    return fullBills;
  }
}

export function mergeBillItems(billItems: Tables['bill_items']['Row'][]): {
  description: string;
  weight: number;
} {
  const description: string[] = [];
  let weight = 0;
  for (const bill of billItems) {
    description.push(
      `${bill.quality} ${bill.product} ${bill.extra} - ${bill.quantity}`
    );
    weight += bill.gross_weight;
  }
  return {
    description: description.join(', '),
    weight,
  };
}

export function getNextSerial(
  serial: string,
  loanNo: string
): [string, number] {
  let number = parseInt(loanNo, 10);
  let charCode = serial.charCodeAt(0);

  number += 1;

  if (number > 10000) {
    number = 1;
    charCode += 1;

    // Wrap from Z → A if needed
    if (charCode > 90) charCode = 65;
  }

  const newLetter = String.fromCharCode(charCode);
  return [newLetter, number];
}

export function getPrevSerial(
  serial: string,
  loanNo: string
): [string, number] {
  let number = parseInt(loanNo, 10);
  let charCode = serial.charCodeAt(0);

  number -= 1;

  if (number < 1) {
    number = 10000;
    charCode -= 1;

    // Wrap from A → Z if needed
    if (charCode < 65) charCode = 90;
  }

  const newLetter = String.fromCharCode(charCode);
  return [newLetter, number];
}
