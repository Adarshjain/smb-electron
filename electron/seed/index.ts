import MDBReader from "mdb-reader";
import fs from "fs";
import path from "path";
import {create, executeSql} from "../db/localDB";
import {MetalType, TableName, Tables} from "../../tables";
import {TablesSQliteSchema} from "../../tableSchema";

let reader: MDBReader | null = null;

const getReader = () => {
    if (reader !== null) {
        return reader;
    }
    // In development: project root, In production: app path
    const mdbPath = path.join(process.cwd(), 'electron', 'seed', 'smb.mdb');
    const buffer = fs.readFileSync(mdbPath);
    reader = new MDBReader(buffer);
    return reader;
}

const toSentenceCase = (name: string) => {
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export const deleteAllRecords = () => {
    for (const table of Object.keys(TablesSQliteSchema) as TableName[])
        executeSql(`DELETE FROM ${table}`, undefined, true)
}


export const initAreas = () => {
    const reader = getReader();
    const table = reader.getTable('areamaster');
    const data = table.getData<Record<string, string>>();


    for (const record of data) {
        try {
            create('areas', {
                name: record.name,
                pincode: record.pincode,
                post: record.post,
                town: record.town,
            })
        } catch (e) {
            console.log(e instanceof Error ? e.message : 'Random Error');
        }
    }
}

export const initBalance = () => {
    const rd = getReader();
    const table = rd.getTable('balance');
    const data = table.getData<Record<string, string>>();


    for (const record of data) {
        try {
            create('balances', {
                date: new Date(record.cl_date).toISOString().split('T')[0], //.split(" at ")[0]
                opening: 0,
                closing: parseFloat(record.cl_bal),
                company: toSentenceCase(record.company),
            })
        } catch (e) {
            console.log(e instanceof Error ? e.message : 'Random Error');
        }
    }
}

export const initCompanies = () => {
    const reader = getReader();
    const table = reader.getTable('companymaster');
    const data = table.getData<Record<string, string>>();


    for (const record of data) {
        try {
            create('companies', {
                name: toSentenceCase(record.NAME),
                next_serial: 'A-1',
                is_default: 0,
                current_date: new Date().toISOString().split('T')[0],
            })
        } catch (e) {
            console.log(e instanceof Error ? e.message : 'Random Error');
        }
    }
}

export const initProducts = () => {
    const reader = getReader();
    const itemDesMaster = reader.getTable('itemdesmaster');
    const itemDesMasterData = itemDesMaster.getData<Record<string, string>>();

    const goldQualityTable = reader.getTable('quality');
    const goldQualityData = goldQualityTable.getData<Record<string, string>>();

    const goldQuality1Table = reader.getTable('quality1');
    const goldQuality1Data = goldQuality1Table.getData<Record<string, string>>();


    for (const record of itemDesMasterData) {
        try {
            create('products', {
                name: record.name,
                product_type: "product",
                metal_type: toSentenceCase(record.itemtype) as MetalType
            })
        } catch (e) {
            console.log(e instanceof Error ? e.message : 'Random Error');
        }
    }

    for (const record of goldQualityData) {
        try {
            create('products', {
                name: record.quality,
                product_type: "quality",
                metal_type: "Other"
            })
        } catch (e) {
            console.log(e instanceof Error ? e.message : 'Random Error');
        }
    }

    for (const record of goldQuality1Data) {
        try {
            create('products', {
                name: record.quality,
                product_type: "seal",
                metal_type: "Other"
            })
        } catch (e) {
            console.log(e instanceof Error ? e.message : 'Random Error');
        }
    }
}

export const initBills = () => {
    const reader = getReader();
    const billingTable = reader.getTable('billing');
    let billingData = billingTable.getData<Record<string, string>>();
    billingData = billingData.filter(record => new Date(record.date) >= new Date('2020-01-01'));


    const itemDesTable = reader.getTable('itemdes');
    const itemDesData = itemDesTable.getData<Record<string, string>>();


    for (const record of billingData) {
        itemDesData.filter((item) => item.serial === record.serial && item.loanno === record.nos).map(item => {
            try {
                create('bill_items', {
                    serial: record.serial,
                    loan_no: parseInt(record.nos),
                    gross_weight: item.grossw ? parseFloat(item.grossw) : 0,
                    ignore_weight: item.ignorew ? parseFloat(item.ignorew) : 0,
                    net_weight: item.netw ? parseFloat(item.netw) : 0,
                    product: item.itemdes,
                    quality: item.quality,
                    extra: item.ituch,
                    quantity: item.quantity ? parseInt(item.qty) : 0,
                })
            } catch (e) {
                console.log(e instanceof Error ? e.message : 'Random Error');
            }
        });
        const loanAmount = parseFloat(record.loan || "0");
        const interestPaid = parseFloat(record.totint || "0")
        const interestDiscount = parseFloat(record.dis || "0")
        try {
            create('bills', {
                serial: record.serial,
                loan_no: parseInt(record.nos),
                date: new Date(record.date).toISOString().split('T')[0],
                company: toSentenceCase(record.company),
                metal_type: toSentenceCase(record.items) as MetalType,
                customer_id: record.code,
                doc_charges: parseFloat(record.otchgrs || "0"),
                first_month_interest: parseFloat(record.intamt || "0"),
                interest_rate: parseFloat(record.intrate || "0"),
                loan_amount: loanAmount,
                released: record.STATUS === 'Redeemed' ? 1 : 0,
            })
            if (record.STATUS === 'Redeemed') {
                create('releases', {
                    serial: record.serial,
                    loan_no: parseInt(record.nos),
                    date: new Date(record.redate).toISOString().split('T')[0],
                    loan_amount: loanAmount,
                    interest_amount: interestPaid,
                    total_amount: loanAmount + interestPaid - interestDiscount,
                })
            }
        } catch (e) {
            console.log(e instanceof Error ? e.message : 'Random Error');
        }
    }
}

export const initCustomers = () => {
    const rd = getReader();
    const table = rd.getTable('customermaster');
    const data = table.getData<Record<string, string>>();


    for (const record of data) {
        try {
            create('customers', {
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
            })
        } catch (e) {
            console.log(e instanceof Error ? e.message : 'Random Error');
        }
    }
}

export const initIntRates = () => {
    const rates: Tables['interest_rates']['Insert'][] = [
        {
            from_: 0,
            to_: 1100,
            rate: 3,
            metal_type: "Gold",
            doc_charges: 3,
            doc_charges_type: "Fixed"
        },
        {
            from_: 1101,
            to_: 4999,
            rate: 2.5,
            metal_type: "Gold",
            doc_charges: 0.3,
            doc_charges_type: "Percentage"
        },
        {
            from_: 5000,
            to_: 500000,
            rate: 2,
            metal_type: "Gold",
            doc_charges: 0.5,
            doc_charges_type: "Percentage"
        },
        {
            from_: 0,
            to_: 1000,
            rate: 3,
            metal_type: "Silver",
            doc_charges: 3,
            doc_charges_type: "Fixed"
        },
        {
            from_: 1001,
            to_: 500000,
            rate: 3,
            metal_type: "Silver",
            doc_charges: 0.3,
            doc_charges_type: "Percentage"
        }
    ]

    for (const rate of rates) {
        try {
            create('interest_rates', rate)
        } catch (e) {
            console.log(e instanceof Error ? e.message : 'Random Error');
        }
    }
}

export const initAllSeedData = () => {
    deleteAllRecords();
    initCompanies();
    initAreas();
    initCustomers();
    initProducts();
    initIntRates();
    initBalance();
    initBills();
}