-- ============================================
-- FundsRoom Mini ERP + CRM - Database Schema
-- ============================================

-- 1. USERS TABLE (for auth + roles)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'sales', 'warehouse', 'accounts')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. CUSTOMERS TABLE (CRM module)
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(150) NOT NULL,
    mobile_number VARCHAR(15) NOT NULL,
    email VARCHAR(150),
    business_name VARCHAR(150),
    gst_number VARCHAR(20),                  -- optional
    customer_type VARCHAR(20) NOT NULL CHECK (customer_type IN ('Retail', 'Wholesale', 'Distributor')),
    address TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'Lead' CHECK (status IN ('Lead', 'Active', 'Inactive')),
    follow_up_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. PRODUCTS TABLE (Inventory module)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    product_name VARCHAR(150) NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(100),
    unit_price NUMERIC(12,2) NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0,
    min_stock_alert INTEGER NOT NULL DEFAULT 0,
    warehouse_location VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. STOCK MOVEMENTS TABLE (audit log for every stock change)
CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity_changed INTEGER NOT NULL,
    movement_type VARCHAR(5) NOT NULL CHECK (movement_type IN ('IN', 'OUT')),
    reason VARCHAR(255),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. CHALLANS TABLE (Sales Challan header)
CREATE TABLE challans (
    id SERIAL PRIMARY KEY,
    challan_number VARCHAR(30) UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    total_quantity INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Confirmed', 'Cancelled')),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. CHALLAN ITEMS TABLE (line items - stores a SNAPSHOT of product data)
CREATE TABLE challan_items (
    id SERIAL PRIMARY KEY,
    challan_id INTEGER NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    -- snapshot fields: copied at time of adding, never updated later
    product_name_snapshot VARCHAR(150) NOT NULL,
    unit_price_snapshot NUMERIC(12,2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);
