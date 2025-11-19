// Form field widths and dimensions
export const FIELD_WIDTHS = {
  SERIAL_INPUT: 'w-14',
  LOAN_NO_INPUT: 'w-24',
  METAL_TYPE_SELECT: 'min-w-60 ml-auto',
  PRODUCT_FIELD: 'w-[280px] min-w-[280px]',
  QUALITY_FIELD: 'w-[280px] min-w-[280px]',
  SEAL_FIELD: 'w-[120px] min-w-[120px] max-w-[120px]',
  QUANTITY_FIELD: 'w-16',
  WEIGHT_FIELD: 'w-24',
  AMOUNT_COLUMN: 'w-[300px]',
  FORM_CONTAINER: 'w-[1000px]',
  ADDON_CURRENCY: 'w-6.5',
} as const;

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  ADD_BILLING_ITEM: '+',
  REMOVE_BILLING_ITEM: 'Delete',
} as const;

// Default decimal precision
export const DECIMAL_PRECISION = 2;

// Form field names for type safety
export const FORM_FIELDS = {
  SERIAL: 'serial',
  LOAN_NO: 'loan_no',
  CUSTOMER_PICKER: 'customer_picker',
  METAL_TYPE: 'metal_type',
  LOAN_AMOUNT: 'loan_amount',
  DOC_CHARGES: 'doc_charges',
  INTEREST_RATE: 'interest_rate',
  FIRST_MONTH_INTEREST: 'first_month_interest',
  TOTAL: 'total',
  DATE: 'date',
  CUSTOMER: 'customer',
  COMPANY: 'company',
  RELEASED: 'released',
  BILLING_ITEMS: 'billing_items',
} as const;

// Billing item field names
export const BILLING_ITEM_FIELDS = {
  PRODUCT: 'product',
  QUALITY: 'quality',
  EXTRA: 'extra',
  QUANTITY: 'quantity',
  GROSS_WEIGHT: 'gross_weight',
  NET_WEIGHT: 'net_weight',
  IGNORE_WEIGHT: 'ignore_weight',
} as const;

// Validation constraints
export const VALIDATION_CONSTRAINTS = {
  SERIAL_LENGTH: { MIN: 1, MAX: 1 },
  LOAN_NO: { MIN: 1, MAX: 10000 },
  LOAN_NO_REGEX: /^\d{0,5}$/,
  RELEASED: { MIN: 0, MAX: 1 },
} as const;

// Default values
export const DEFAULT_BILLING_ITEM = {
  product: '',
  quality: '',
  extra: '',
  quantity: 0,
  gross_weight: '0.00',
  net_weight: '0.00',
  ignore_weight: '0.00',
} as const;

export const toastStyles = {
  success: '!bg-green-600 !text-white !border-green-700',
  error: '!bg-red-600 !text-white !border-red-700',
  warning: '!bg-amber-500 !text-white !border-amber-600',
  info: '!bg-blue-600 !text-white !border-blue-700',
};
