import MDBReader from 'mdb-reader';
import fs from 'fs';
import { createBatched, executeSql } from '../db/localDB';
import { type MetalType, type TableName, type Tables } from '../../tables';
import { TablesSQliteSchema } from '../../tableSchema';

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

  for (const record of data) {
    createAreas.push({
      name: record.name,
      pincode: record.pincode,
      post: record.post,
      town: record.town,
    });
  }
  try {
    createBatched('areas', createAreas);
  } catch (e) {
    console.log(e instanceof Error ? e.message : 'Random Error');
  }
};

export const initBalance = () => {
  if (!reader) {
    return;
  }
  const table = reader.getTable('balance');
  const data = table.getData<Record<string, string>>();

  const createBalances: Tables['balances']['Row'][] = [];

  for (const record of data) {
    createBalances.push({
      date: new Date(record.cl_date).toISOString().split('T')[0], //.split(" at ")[0]
      opening: 0,
      closing: parseFloat(record.cl_bal),
      company: toSentenceCase(record.company),
    });
  }
  try {
    createBatched('balances', createBalances);
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
    createCompanies.push({
      name: toSentenceCase(record.NAME),
      next_serial: 'A-1',
      is_default: 0,
      current_date: new Date().toISOString().split('T')[0],
    });
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
    (record) => new Date(record.date) >= new Date('2020-01-01')
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
      createReleases.push({
        serial: record.serial,
        loan_no: parseInt(record.nos),
        date: new Date(record.redate).toISOString().split('T')[0],
        loan_amount: loanAmount,
        interest_amount: interestPaid,
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
  initBalance();
  initBills();
};
