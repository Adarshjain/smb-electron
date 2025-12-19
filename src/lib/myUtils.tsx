import { toast } from 'sonner';
import type { ElectronToReactResponse } from '../../shared-types';
import type {
  FullCustomer,
  LocalTables,
  MetalType,
  Tables,
} from '../../tables';
import MyCache from '../../MyCache.ts';
import { batchQuery, query, read } from '@/hooks/dbUtil.ts';
import { toastStyles } from '@/constants/loanForm.ts';
import { cn } from '@/lib/utils.ts';
import { captureException } from '@/lib/sentry.ts';

// Native date utility functions (replacing date-fns)
function padZero(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDate(date: Date, formatStr: string): string {
  const day = padZero(date.getDate());
  const month = padZero(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = padZero(date.getMinutes());
  const seconds = padZero(date.getSeconds());
  const ampm = hours24 >= 12 ? 'PM' : 'AM';

  switch (formatStr) {
    case 'dd/MM/yyyy':
      return `${day}/${month}/${year}`;
    case 'dd/MM/yyyy hh:mm:ss a':
      return `${day}/${month}/${year} ${padZero(hours12)}:${minutes}:${seconds} ${ampm}`;
    case 'yyyy-MM-dd':
      return `${year}-${month}-${day}`;
    default:
      return date.toISOString();
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function subDays(date: Date, n: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - n);
  return result;
}

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

export function rpcError(response: { success: false; error: string }) {
  toast.error(`Error: ${response.error}`, {
    description: (
      <pre className="bg-code text-code-foreground mt-2 w-full overflow-x-auto rounded-md p-4">
        {/*<code>{response.stack}</code>*/}
      </pre>
    ),
    classNames: { content: cn('flex flex-col gap-2', toastStyles.error) },
    style: {
      '--border-radius': 'calc(var(--radius) + 4px)',
    } as React.CSSProperties,
  });
}

export function viewableDate(
  dateStr?: string | Date,
  includeTime = false
): string {
  return formatDate(
    dateStr ? new Date(dateStr) : new Date(),
    includeTime ? 'dd/MM/yyyy hh:mm:ss a' : 'dd/MM/yyyy'
  );
}

export function getDay(date: string): string {
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  return days[new Date(date).getDay()];
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
  console.error(msg);
  if (msg instanceof Error) {
    rpcError({
      success: false,
      error: msg.message,
    });
  } else {
    toast.error(msg as string, { className: toastStyles.error });
  }
  captureException(msg as string | Error);
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
): Promise<Tables['interest_rates'] | undefined> {
  const cache = new MyCache<Tables['interest_rates'][]>('IntRates');
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

export function getMonthDiff(from: string | Date, to?: string | Date): number {
  const now = to ? new Date(to) : new Date();
  const start = new Date(from);
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  if (+start === +now) {
    return 0;
  }
  return start.getDate() === now.getDate() ? months - 1 : months;
}

export function getTaxedMonthDiff(from: string | Date, to?: string | Date) {
  return getMonthDiff(from, to) + 1;
}

export function adjustEndDate(startDate: Date, endDate: Date, n: number): Date {
  startDate = startDate ? new Date(startDate) : new Date();
  endDate = new Date(endDate);

  const start = startOfDay(startDate);
  let end = startOfDay(endDate);

  if (end < start) {
    end = subDays(end, n);
    if (end < start) {
      end = start;
    }
  }

  return end;
}

export function getDocCharges(
  principal: number,
  rate: Tables['interest_rates']
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
): Promise<Tables['full_bill'] | null> {
  try {
    const upperSerial = serial.toUpperCase();

    // Batch all queries in a single IPC call
    const results = await batchQuery<
      [LocalTables<'bills'>[], LocalTables<'bill_items'>[]]
    >([
      {
        sql: `SELECT * FROM bills WHERE serial = ? AND loan_no = ? AND deleted IS NULL`,
        params: [upperSerial, loanNo],
      },
      {
        sql: `SELECT * FROM bill_items WHERE serial = ? AND loan_no = ? AND deleted IS NULL`,
        params: [upperSerial, loanNo],
      },
    ]);

    const [loans, billItems] = results;

    if (!loans?.length) {
      errorToast('No loan found with given Serial and Loan Number');
      return null;
    }
    const currentLoan = loans[0];

    if (!billItems?.length) {
      errorToast('No items match');
      return null;
    }

    // Fetch customer separately (needs customer_id from loan)
    const fullCustomer = await fetchFullCustomer(currentLoan.customer_id);
    if (!fullCustomer) {
      errorToast('No fullCustomer match');
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

// Cache for customers and areas
const customerCache = new MyCache<FullCustomer>('CustomerCache');

export async function fetchFullCustomer(
  customerId: string
): Promise<FullCustomer | null> {
  // Check cache first
  const cached = customerCache.get(customerId);
  if (cached) return cached;

  try {
    const customers = await read('customers', {
      id: customerId,
    });
    if (!customers?.length) {
      errorToast('No customer matched');
      return null;
    }
    const customer = customers[0];
    const areas = await read('areas', {
      name: customer.area,
    });
    if (!areas?.length) {
      errorToast('No area match');
      return null;
    }
    const fullCustomer = {
      customer: customer,
      area: areas[0],
    };

    // Cache the result
    customerCache.set(customerId, fullCustomer);

    return fullCustomer;
  } catch (e) {
    errorToast(e);
    return null;
  }
}

export async function fetchBillsByCustomer(
  customerId: string,
  skipReleased = true
): Promise<Tables['full_bill'][] | undefined> {
  try {
    // Fetch bills and customer in parallel
    const [billsResponse, fullCustomer] = await Promise.all([
      query<LocalTables<'bills'>[] | null>(
        skipReleased
          ? `SELECT * FROM bills WHERE customer_id = ? AND deleted IS NULL AND released = 0 ORDER BY date`
          : `SELECT * FROM bills WHERE customer_id = ? AND deleted IS NULL ORDER BY date`,
        [customerId]
      ),
      fetchFullCustomer(customerId),
    ]);

    if (!fullCustomer || !billsResponse?.length) {
      return undefined;
    }

    // Build a single batch query for all bill items
    const billItemQueries = billsResponse.map((bill) => ({
      sql: `SELECT * FROM bill_items WHERE serial = ? AND loan_no = ? AND deleted IS NULL`,
      params: [bill.serial, bill.loan_no] as unknown[],
    }));

    // If we need releases, add those queries too
    const releaseQueries = !skipReleased
      ? billsResponse
          .filter((bill) => bill.released === 1)
          .map((bill) => ({
            sql: `SELECT * FROM releases WHERE serial = ? AND loan_no = ? AND deleted IS NULL`,
            params: [bill.serial, bill.loan_no] as unknown[],
          }))
      : [];

    // Execute all queries in a single batch IPC call
    const allResults = await batchQuery<unknown[][]>([
      ...billItemQueries,
      ...releaseQueries,
    ]);

    // Split results
    const allBillItems = allResults.slice(
      0,
      billsResponse.length
    ) as LocalTables<'bill_items'>[][];

    // Build a map of releases by serial-loan_no
    const releaseMap = new Map<string, LocalTables<'releases'>>();
    if (!skipReleased && releaseQueries.length > 0) {
      const releaseResults = allResults.slice(
        billsResponse.length
      ) as LocalTables<'releases'>[][];
      const releasedBills = billsResponse.filter((bill) => bill.released === 1);
      releasedBills.forEach((bill, i) => {
        const release = releaseResults[i]?.[0];
        if (release) {
          releaseMap.set(`${bill.serial}-${bill.loan_no}`, release);
        }
      });
    }

    // Combine results
    const fullBills: Tables['full_bill'][] = [];
    for (let i = 0; i < billsResponse.length; i++) {
      const bill = billsResponse[i];
      const billItems = allBillItems[i];
      const release = releaseMap.get(`${bill.serial}-${bill.loan_no}`);

      if (billItems?.length) {
        fullBills.push({
          ...bill,
          full_customer: fullCustomer,
          bill_items: billItems,
          releasedEntry: release,
        });
      }
    }

    return fullBills;
  } catch (e) {
    errorToast(e);
    return undefined;
  }
}

export function mergeBillItems(
  billItems: Tables['bill_items'][],
  metalType: MetalType
): {
  description: string;
  weight: number;
} {
  const description: string[] = [];
  let weight = 0;
  for (const billItem of billItems) {
    description.push(
      metalType === 'Gold'
        ? `${billItem.quality} ${billItem.extra} ${billItem.product} - ${billItem.quantity}`
        : `${billItem.extra} ${billItem.quality} ${billItem.product} - ${billItem.quantity}`
    );
    weight += billItem.gross_weight;
  }
  return {
    description: description.join(','),
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

export function getFinancialYearRange(year: number): [string, string] {
  const startDate = new Date(year, 3, 1); // April 1
  const endDate = new Date(year + 1, 2, 31); // March 31

  return [
    formatDate(startDate, 'yyyy-MM-dd'),
    formatDate(endDate, 'yyyy-MM-dd'),
  ];
}

export function jsNumberFix(num: number): number {
  return Number(num.toFixed(2));
}

export function datesToRange(
  startDate: string,
  endDate: string
): { year?: number; range?: [string, string] } {
  const from = new Date(startDate);
  const to = new Date(endDate);
  if (
    from.getDate() === 1 &&
    from.getMonth() + 1 === 4 &&
    to.getDate() === 31 &&
    to.getMonth() + 1 === 3 &&
    to.getFullYear() - from.getFullYear() === 1
  ) {
    return { year: from.getFullYear() };
  }
  return { range: [startDate, endDate] };
}
export function uniqueV6() {
  return Date.now().toString(36) + Math.random().toString(36);
}

export function getAccountById(
  accountHeads: Tables['account_head'][],
  code: number
): Tables['account_head'] | undefined {
  return accountHeads.find((head) => head.code === code);
}

export function sortOrderPromise() {
  return query<[{ sort_order: number }]>(
    `SELECT sort_order
               FROM daily_entries
               ORDER BY sort_order DESC
               LIMIT 1`
  );
}

export async function getNextExistingBill(
  initialSerial: string,
  initialLoanNo: number,
  maxIterations = 1000
) {
  let serial = initialSerial;
  let loanNo = initialLoanNo;

  for (let i = 0; i < maxIterations; i++) {
    const resp = await read('bills', {
      serial,
      loan_no: loanNo,
    });

    if (resp?.length) {
      return { serial, loanNo };
    }

    [serial, loanNo] = getNextSerial(serial, String(loanNo));
  }

  return null;
}
export async function getPreviousExistingBill(
  initialSerial: string,
  initialLoanNo: number,
  maxIterations = 1000
) {
  let serial = initialSerial;
  let loanNo = initialLoanNo;

  for (let i = 0; i < maxIterations; i++) {
    const resp = await read('bills', {
      serial,
      loan_no: loanNo,
    });

    if (resp?.length) {
      return { serial, loanNo };
    }

    [serial, loanNo] = getPrevSerial(serial, String(loanNo));
  }

  return null;
}
