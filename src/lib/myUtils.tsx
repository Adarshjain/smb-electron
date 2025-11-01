import { toast } from 'sonner';
import { format } from 'date-fns';
import type { ElectronToReactResponse } from '../../shared-types';
import type { MetalType, Tables } from '../../tables';
import MyCache from '../../MyCache.ts';
import { read } from '@/hooks/dbUtil.ts';

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
    classNames: { content: 'flex flex-col gap-2' },
    style: {
      '--border-radius': 'calc(var(--radius) + 4px)',
    } as React.CSSProperties,
  });
}

export function viewableDate(dateStr: string): string {
  return format(new Date(dateStr), 'dd/MM/yyyy');
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

export function toastElectronResponse<T>(
  response: ElectronToReactResponse<T>,
  successMessage = 'Success'
) {
  if (!response.success) {
    if (response.error === 'UNIQUE constraint failed') {
      toast.error('Already exists!');
    } else {
      rpcError(response);
    }
  } else {
    toast.success(successMessage);
  }
}

export async function getRate(
  principal: number,
  metalType: MetalType
): Promise<Tables['interest_rates']['Row'] | undefined> {
  const cache = new MyCache<Tables['interest_rates']['Row'][]>('IntRates');
  let intRates = cache.get('intRates');
  if (!intRates) {
    const response = await read('interest_rates', {});
    if (response.success) {
      cache.set('intRates', response.data ?? []);
      intRates = response.data ?? [];
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

export function monthDiff(from: string, to?: string) {
  const now = to ? new Date(to) : new Date();
  const start = new Date(from);
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  return start.getDate() === now.getDate() ? months - 1 : months;
}

export function getDocCharges(
  principal: number,
  rate: Tables['interest_rates']['Row']
): number {
  const { doc_charges: docCharges } = rate;
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
  const loan = await read('bills', {
    serial: serial.toUpperCase(),
    loan_no: loanNo,
  });
  if (!(loan.success && loan.data?.length)) {
    toast.error('No loan found with given Serial and Loan Number');
    return null;
  }
  const currentLoan = loan.data[0];
  const customer = await read('customers', {
    id: currentLoan.customer_id,
  });
  if (!(customer.success && customer.data?.length)) {
    toast.error('No customer match');
    return null;
  }
  const billItems = await read('bill_items', {
    serial: serial.toUpperCase(),
    loan_no: loanNo,
  });
  if (!(billItems.success && billItems.data?.length)) {
    toast.error('No items match');
    return null;
  }

  return {
    ...currentLoan,
    customer: customer.data[0],
    bill_items: billItems.data,
  };
}

export async function fetchBillsByCustomer(
  customerId: string,
  skipReleased = true
): Promise<Tables['full_bill']['Row'][] | undefined> {
  const billsPromise = read('bills', {
    customer_id: customerId,
    released: skipReleased ? 0 : undefined,
  });
  const customerPromise = read('customers', {
    id: customerId,
  });
  const [customerResponse, billsResponse] = await Promise.all([
    customerPromise,
    billsPromise,
  ]);
  if (
    customerResponse.success &&
    billsResponse.success &&
    customerResponse.data?.length &&
    billsResponse.data?.length
  ) {
    const customer = customerResponse.data[0];
    const fullBills: Tables['full_bill']['Row'][] = [];
    for (const bill of billsResponse.data) {
      const billItemsResponse = await read('bill_items', {
        serial: bill.serial,
        loan_no: bill.loan_no,
      });
      if (billItemsResponse.success && billItemsResponse.data?.length) {
        fullBills.push({
          ...bill,
          customer: customer,
          bill_items: billItemsResponse.data,
        });
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
