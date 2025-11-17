import MDBReader from 'mdb-reader';
import fs from 'fs';
import { createBatched, executeSql } from '../db/localDB';
import { type MetalType, type TableName, type Tables } from '../../tables';
import { TablesSQliteSchema } from '../../tableSchema';
import { addMonths, differenceInMonths, isBefore } from 'date-fns';

const openingBalanceMap: Record<string, Record<string, number>> = {
  'Mahaveer Bankers': {
    'ADVANCE TAX PAID': 15000,
    'ASHOK KUMAR JAIN': -97138,
    'AUDITOR FEES': 8000,
    'BANK CHARGES': 1894,
    'BANK INTEREST RECEIVED': -9925,
    'CAPITAL A/C': 2604100.27,
    CASH: 510061.95,
    'CASH ADJUSTMENT': 84.93,
    'CITY UNION BANK A/C': 6035.27,
    DRAWINGS: 243622,
    'EQUITAS BANK SB A/C': 5911.16,
    EXPENSE: 80,
    'GIFT FROM SHILPA': 200000,
    'INCOME TAX PAID': 23966,
    'INCOME TAX REFUND': -8960,
    'INT. PAID TO A K JAIN': 3880,
    'INTEREST RECEIVED': 887635,
    'INTEREST RECEIVED FROM ASHOK KUMAR JAIN': -235302,
    'INTEREST RECEIVED FROM GHISULAL TALEDA': -14625,
    'JEWELS (207.14G)': -17364,
    LIC: 118768,
    'LOAN ACCOUNT': 3693255,
    'MANTRA MODEM': 4700,
    'MISCELLANEOUS INCOME': -775761,
    'NOVAPAY CHARGES': 2750.32,
    'NOVO PAY COMISSION': -4561.2,
    NOVOPAY: 19783.79,
    'NOVOPAY TDS': 124,
    SALARY: 130000,
    'SILVER ARTICLES (14.206.5KG)': -12628,
    'STATIONARY & POSTAGE': 20099.05,
  },
  'Sri Mahaveer Bankers': {
    'ADINTEREST RECEIVED ': -280,
    'ADVANCE TAX PAID': 70000,
    ARCHANA: 97138,
    'ASHOK KUMAR CAPITAL A/C': 2290456.38,
    'ASHOK KUMAR-HUF': -4250000,
    'AUCTION CHARGES': 40200,
    'AUCTION INTEREST': -902790,
    'AUDITOR FEES': 13000,
    'AXIS BANK SB A/C': 403608.4,
    'BANK CHARGES': 5229.29,
    'BANK INTEREST RECEIVED': -119327,
    'BANK INTREST PAID': 358969,
    'BUILDING CONSTRUCTION A/C': 4107793,
    CASH: 505324,
    'CITY UNION BANK': 2353,
    'COLLEGE FEES': 127230,
    DONATION: 1200,
    DRAWINGS: 601000,
    'ELETRIC BILL': 15843,
    'EQUITAS BANK C/A': 5000.38,
    'EQUITAS BANK SB A/C': 3969,
    'FURNITURE ': 1050,
    'GAS SUBSIDY': -7151.12,
    'GHISULAL HUF': -4800000,
    'GIFT FROM ADARSH': -100000,
    'GIFT FROM SHILPA': -300000,
    'GL CAPITAL TRANSFER A/C': -1367651.29,
    'HOUSE PROPERTY ': 1168202,
    'INCOME TAX': 36560,
    'INCOME TAX REFUND': -18340,
    'INTEREST PAID ARCHANA': 235302,
    'INTEREST PAID TO ADARSH JAIN': 788500,
    'INTEREST PAID TO ASHOKUMAR HUF': 1830500,
    'INTEREST PAID TO CHANDARA KALA': 34915,
    'INTEREST PAID TO DEEPA': 14297,
    'INTEREST PAID TO GHISULAL HUF': 2023000,
    'INTEREST PAID TO RAMESH': 78750,
    'INTEREST PAID TO SHILPA': 529352,
    'INTEREST RECEIVED': -3943201,
    'INTEREST RECEIVED FROM GURU': -23250,
    'INTEREST RECIVED FROM ARCHANA': -3880,
    'INTEREST RECIVED FROM SANTHOSH': -24855,
    'INTEREST RECIVED FROM YOGANATHAN': -112500,
    'INTEREST REWCIVED FROM MAHAVEER': -34915,
    'INTEREST RICEVED BANK (GL)': -4182,
    IRCTC: 2593,
    LIC: 239991,
    'LOAN ACCOUNT': 9462195,
    'MISC. EXPENSES': 10345,
    'MISCELLANEOUS INCOME': -3679479,
    'MUNICIPAL TAX': 17880,
    'PHONE DEPO WRITTEN OF': 2000,
    'PPF INT RICIVED': -12695,
    SALARY: 445250,
    'SBI  PPF A/C': 62695,
    'SHARES IN COMP. WRITTEN OF': 2000,
    'SILVER ARTICLES(GL) 25.500KG': 7650,
    'STATINORY &POSTAGE': 88945.58,
    'TELEPHONE BILL': 11957,
    'TRAVELLING EXP': 19935,
    'UNION BANK HOUSING LOAN': -1781050.57,
    'UNION BANK SB A/C': 4281.71,
    YOGANATHAN: 300000,
  },
};

let reader: MDBReader | null = null;

const initReader = (filePath: string) => {
  const buffer = fs.readFileSync(filePath);
  reader = new MDBReader(buffer);
};

const toSentenceCase = (name: string) => {
  return name
    .toLowerCase()
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function getTaxedMonthDiff(from: string | Date, to?: string | Date) {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
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

export const deleteAllRecords = () => {
  for (const table of Object.keys(TablesSQliteSchema) as TableName[])
    executeSql(`DELETE FROM ${table}`, undefined, true);
};

export const initAreas = () => {
  if (!reader) {
    return;
  }
  const table = reader.getTable('areamaster');
  const data = table.getData<Record<string, string>>();

  const createAreas: Tables['areas']['Row'][] = [];

  const map: Record<string, boolean> = {};

  for (const record of data) {
    if (!map[record.name]) {
      createAreas.push({
        name: record.name,
        pincode: record.pincode,
        post: record.post,
        town: record.town,
      });
      map[record.name] = true;
    }
  }
  try {
    createBatched('areas', createAreas);
  } catch (e) {
    console.log(e instanceof Error ? e.message : 'Random Error');
  }
};

export const initAccountHead = () => {
  if (!reader) {
    return;
  }
  const table = reader.getTable('accounthead');
  let data = table.getData<Record<string, string>>();
  data = data.filter(
    (d) =>
      d.company.toLowerCase() === 'mahaveer bankers' ||
      d.company.toLowerCase() === 'sri mahaveer bankers'
  );

  const createAccountHead: Tables['account_head']['Row'][] = [];

  for (const record of data) {
    const company = toSentenceCase(record.company);
    createAccountHead.push({
      name: record.acc_name,
      company,
      code: parseInt('' + record.acc_code),
      hisaabGroup: record.SEARCHBY,
      openingBalance: openingBalanceMap[company][record.acc_name] ?? 0,
    });
  }
  try {
    createBatched('account_head', createAccountHead);
  } catch (e) {
    console.log(e instanceof Error ? e.message : 'Random Error');
  }
};

export const initDailyEntries = () => {
  if (!reader) {
    return;
  }
  const table = reader.getTable('Voucher2');
  const data = table.getData<Record<string, string>>();

  const createDailyBalances: Tables['daily_entries']['Row'][] = [];

  for (const record of data) {
    if (parseFloat('' + (record.dr || record.cr)) === 0) {
      continue;
    }
    createDailyBalances.push({
      date: new Date(record.date).toISOString().split('T')[0],
      company: toSentenceCase(record.company),
      description: record.description ?? null,
      particular: record.particular ?? null,
      particular1: record.particular1 ?? null,
      debit: parseFloat('' + record.dr),
      credit: parseFloat('' + record.cr),
      code_1: parseInt('' + record.acc_code),
      code_2: parseInt('' + record.code),
      sortOrder: parseInt('' + record.rec_id),
    });
  }
  try {
    createBatched('daily_entries', createDailyBalances);
  } catch (e) {
    console.log(e instanceof Error ? e.message : 'Random Error');
  }
};

export const initCompanies = () => {
  if (!reader) {
    return;
  }
  const table = reader.getTable('companymaster');
  const data = table.getData<Record<string, string>>();

  const createCompanies: Tables['companies']['Row'][] = [];

  for (const record of data) {
    if (
      record.NAME.toLowerCase() === 'mahaveer bankers' ||
      record.NAME.toLowerCase() === 'sri mahaveer bankers'
    ) {
      createCompanies.push({
        name: toSentenceCase(record.NAME),
        next_serial: 'A-1',
        is_default: 0,
        current_date: new Date().toISOString().split('T')[0],
      });
    }
  }
  try {
    createBatched('companies', createCompanies);
  } catch (e) {
    console.log(e instanceof Error ? e.message : 'Random Error');
  }
};

export const initProducts = () => {
  if (!reader) {
    return;
  }
  const itemDesMaster = reader.getTable('itemdesmaster');
  const itemDesMasterData = itemDesMaster.getData<Record<string, string>>();

  const goldQualityTable = reader.getTable('quality');
  const goldQualityData = goldQualityTable.getData<Record<string, string>>();

  const goldQuality1Table = reader.getTable('quality1');
  const goldQuality1Data = goldQuality1Table.getData<Record<string, string>>();

  const createProducts: Tables['products']['Row'][] = [];

  for (const record of itemDesMasterData) {
    createProducts.push({
      name: record.name,
      product_type: 'product',
      metal_type: toSentenceCase(record.itemtype) as MetalType,
    });
  }

  for (const record of goldQualityData) {
    createProducts.push({
      name: record.quality,
      product_type: 'quality',
      metal_type: 'Other',
    });
  }

  for (const record of goldQuality1Data) {
    createProducts.push({
      name: record.quality,
      product_type: 'seal',
      metal_type: 'Other',
    });
  }
  try {
    createBatched('products', createProducts);
  } catch (e) {
    console.log(e instanceof Error ? e.message : 'Random Error');
  }
};

export const initBills = () => {
  if (!reader) {
    return;
  }
  const billingTable = reader.getTable('billing');
  let billingData = billingTable.getData<Record<string, string>>();
  billingData = billingData.filter(
    (record) =>
      new Date(record.date) > new Date('2019-12-31') &&
      (record.company.toLowerCase() === 'mahaveer bankers' ||
        record.company.toLowerCase() === 'sri mahaveer bankers')
  );

  const itemDesTable = reader.getTable('itemdes');
  const itemDesData = itemDesTable.getData<Record<string, string>>();

  const createBillItems: Tables['bill_items']['Row'][] = [];
  const createBills: Tables['bills']['Row'][] = [];
  const createReleases: Tables['releases']['Row'][] = [];

  for (const record of billingData) {
    itemDesData
      .filter(
        (item) => item.serial === record.serial && item.loanno === record.nos
      )
      .forEach((item) => {
        createBillItems.push({
          serial: record.serial,
          loan_no: parseInt(record.nos),
          gross_weight: Number(
            ((item.grossw as unknown as number) ?? 0).toFixed(2)
          ),
          ignore_weight: Number(
            ((item.ignorew as unknown as number) ?? 0).toFixed(2)
          ),
          net_weight: Number(
            ((item.netw as unknown as number) ?? 0).toFixed(2)
          ),
          product: item.itemdes,
          quality: item.quality,
          extra: item.ituch,
          quantity: item.qty ? parseInt(item.qty) : 0,
        });
      });
    const loanAmount = parseFloat(record.loan || '0');
    const interestPaid = parseFloat(record.totint || '0');
    const interestDiscount = parseFloat(record.dis || '0');
    createBills.push({
      serial: record.serial,
      loan_no: parseInt(record.nos),
      date: new Date(record.date).toISOString().split('T')[0],
      company: toSentenceCase(record.company),
      metal_type: toSentenceCase(record.items) as MetalType,
      customer_id: record.code,
      doc_charges: parseFloat(record.otchgrs || '0'),
      first_month_interest: parseFloat(record.intamt || '0'),
      interest_rate: parseFloat(record.intrate || '0'),
      loan_amount: loanAmount,
      released: record.STATUS === 'Redeemed' ? 1 : 0,
    });
    if (record.STATUS === 'Redeemed') {
      const tax_interest_amount =
        (loanAmount *
          getTaxedMonthDiff(
            new Date(record.date).toISOString().split('T')[0],
            new Date(record.redate).toISOString().split('T')[0]
          )) /
        100;
      createReleases.push({
        serial: record.serial,
        loan_no: parseInt(record.nos),
        date: new Date(record.redate).toISOString().split('T')[0],
        loan_date: new Date(record.date).toISOString().split('T')[0],
        loan_amount: loanAmount,
        tax_interest_amount,
        interest_amount: interestPaid - interestDiscount,
        total_amount: loanAmount + interestPaid - interestDiscount,
        company: toSentenceCase(record.company),
      });
    }
  }

  try {
    createBatched('bill_items', createBillItems);
    createBatched('bills', createBills);
    createBatched('releases', createReleases);
  } catch (e) {
    console.log(e instanceof Error ? e.message : 'Random Error');
  }
};

export const initCustomers = () => {
  if (!reader) {
    return;
  }
  const table = reader.getTable('customermaster');
  const data = table.getData<Record<string, string>>();

  const addresses = new Set<string>();
  const createCustomers: Tables['customers']['Row'][] = [];

  for (const record of data) {
    if (record.address1.trim()) {
      addresses.add(record.address1);
    }
    if (record.address2.trim()) {
      addresses.add(record.address2);
    }
    createCustomers.push({
      id: record.code,
      name: record.name,
      fhname: record.fhname,
      fhtitle: record.fhtitle,
      door_no: record.CUST_DNO,
      address1: record.address1,
      address2: record.address2,
      area: record.area,
      phone_no: record.cell,
      id_proof: record.id,
      id_proof_value: record.id_det,
    });
  }
  const createAddressLines: Tables['address_lines']['Row'][] = [
    ...addresses,
  ].map((addr) => ({ address: addr }));

  try {
    createBatched('customers', createCustomers);
    createBatched('address_lines', createAddressLines);
  } catch (e) {
    console.log(e instanceof Error ? e.message : 'Random Error');
  }
};

export const initIntRates = () => {
  const rates: Tables['interest_rates']['Insert'][] = [
    {
      from_: 0,
      to_: 1100,
      rate: 3,
      metal_type: 'Gold',
      doc_charges: 3,
      doc_charges_type: 'Fixed',
    },
    {
      from_: 1101,
      to_: 4999,
      rate: 2.5,
      metal_type: 'Gold',
      doc_charges: 0.3,
      doc_charges_type: 'Percentage',
    },
    {
      from_: 5000,
      to_: 500000,
      rate: 2,
      metal_type: 'Gold',
      doc_charges: 0.5,
      doc_charges_type: 'Percentage',
    },
    {
      from_: 0,
      to_: 1000,
      rate: 3,
      metal_type: 'Silver',
      doc_charges: 3,
      doc_charges_type: 'Fixed',
    },
    {
      from_: 1001,
      to_: 500000,
      rate: 3,
      metal_type: 'Silver',
      doc_charges: 0.3,
      doc_charges_type: 'Percentage',
    },
  ];

  try {
    createBatched('interest_rates', rates);
  } catch (e) {
    console.log(e instanceof Error ? e.message : 'Random Error');
  }
};

export const initAllSeedData = (filePath: string) => {
  initReader(filePath);
  deleteAllRecords();
  initCompanies();
  initAreas();
  initCustomers();
  initProducts();
  initIntRates();
  initBills();
  initAccountHead();
  initDailyEntries();
};
