BEGIN;
-- ============================================
-- Table: areas
-- ============================================
CREATE TABLE IF NOT EXISTS public.areas
(
    name    TEXT NOT NULL,
    post    TEXT,
    town    TEXT,
    pincode TEXT,
    PRIMARY KEY (name),
    UNIQUE (name)
);

-- ============================================
-- Table: companies
-- ============================================
CREATE TABLE IF NOT EXISTS public.companies
(
    name           TEXT    NOT NULL,
    "current_date" TEXT    NOT NULL,
    next_serial    TEXT    NOT NULL DEFAULT '',
    is_default     BOOLEAN NOT NULL DEFAULT FALSE,


    PRIMARY KEY (name),
    UNIQUE (name)
);

-- ============================================
-- Table: products
-- ============================================
CREATE TABLE IF NOT EXISTS public.products
(
    name         TEXT NOT NULL,
    metal_type   TEXT NOT NULL CHECK (metal_type IN ('Gold', 'Silver', 'Other')),
    product_type TEXT NOT NULL CHECK (product_type IN ('product', 'quality', 'seal')),


    PRIMARY KEY (name),
    UNIQUE (name)
);

-- ============================================
-- Table: customers
-- ============================================
CREATE TABLE IF NOT EXISTS public.customers
(
    id             TEXT NOT NULL,
    address1       TEXT,
    address2       TEXT,
    area           TEXT,
    phone_no       TEXT,
    fhtitle        TEXT NOT NULL,
    fhname         TEXT NOT NULL,
    name           TEXT NOT NULL,
    id_proof       TEXT,
    id_proof_value TEXT,
    door_no        TEXT,
    PRIMARY KEY (id),
    UNIQUE (id)
);

-- ============================================
-- Table: account_head
-- ============================================
CREATE TABLE IF NOT EXISTS public.account_head
(
    code            DOUBLE PRECISION NOT NULL,
    opening_balance DOUBLE PRECISION NOT NULL,
    name            TEXT             NOT NULL,
    hisaab_group    TEXT             NOT NULL,
    company         TEXT             NOT NULL,
    PRIMARY KEY (code, company),
    UNIQUE (code, company)
);

-- ============================================
-- Table: daily_entries
-- ============================================
CREATE TABLE IF NOT EXISTS public.daily_entries
(
    debit       DOUBLE PRECISION NOT NULL,
    credit      DOUBLE PRECISION NOT NULL,
    main_code   DOUBLE PRECISION NOT NULL,
    sub_code    DOUBLE PRECISION NOT NULL,
    sort_order  DOUBLE PRECISION NOT NULL,
    description TEXT,
    company     TEXT             NOT NULL,
    date        TEXT             NOT NULL,
    PRIMARY KEY (date, company, sort_order, main_code, sub_code)
);

-- ============================================
-- Table: bills
-- ============================================
CREATE TABLE IF NOT EXISTS public.bills
(
    serial               TEXT             NOT NULL,
    loan_no              INTEGER          NOT NULL,
    date                 TEXT             NOT NULL,
    customer_id          TEXT,
    loan_amount          DOUBLE PRECISION NOT NULL,
    interest_rate        DOUBLE PRECISION NOT NULL,
    first_month_interest DOUBLE PRECISION NOT NULL,
    doc_charges          DOUBLE PRECISION NOT NULL,
    metal_type           TEXT             NOT NULL CHECK (metal_type IN ('Gold', 'Silver', 'Other')),
    released             BOOLEAN          NOT NULL DEFAULT FALSE,
    company              TEXT,
    PRIMARY KEY (serial, loan_no),
    UNIQUE (serial, loan_no)
);

-- ============================================
-- Table: bill_items
-- ============================================
CREATE TABLE IF NOT EXISTS public.bill_items
(
    serial        TEXT             NOT NULL,
    loan_no       INTEGER          NOT NULL,
    product       TEXT             NOT NULL,
    quality       TEXT,
    extra         TEXT,
    quantity      INTEGER          NOT NULL,
    gross_weight  DOUBLE PRECISION NOT NULL,
    net_weight    DOUBLE PRECISION NOT NULL,
    ignore_weight DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (serial, loan_no)
);

-- ============================================
-- Table: releases
-- ============================================
CREATE TABLE IF NOT EXISTS public.releases
(
    serial              TEXT             NOT NULL,
    loan_no             INTEGER          NOT NULL,
    date                TEXT             NOT NULL,
    loan_date           TEXT             NOT NULL,
    interest_amount     DOUBLE PRECISION NOT NULL,
    tax_interest_amount DOUBLE PRECISION NOT NULL,
    loan_amount         DOUBLE PRECISION NOT NULL,
    total_amount        DOUBLE PRECISION NOT NULL,
    company             TEXT,
    PRIMARY KEY (serial, loan_no),
    UNIQUE (serial, loan_no)
);

-- ============================================
-- Table: interest_rates
-- ============================================
CREATE TABLE IF NOT EXISTS public.interest_rates
(
    metal_type       TEXT             NOT NULL CHECK (metal_type IN ('Gold', 'Silver', 'Other')),
    rate             DOUBLE PRECISION NOT NULL,
    from_            INTEGER          NOT NULL,
    to_              INTEGER          NOT NULL,
    doc_charges      DOUBLE PRECISION NOT NULL,
    doc_charges_type TEXT             NOT NULL CHECK (doc_charges_type IN ('Fixed', 'Percentage')),
    PRIMARY KEY (rate, from_, to_),
    UNIQUE (rate, from_, to_)
);
COMMIT;