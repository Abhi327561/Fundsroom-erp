import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool } from './config/db';

dotenv.config();

// Run with: npm run seed
// Creates one login user per role, plus a few sample customers/products
// so the app isn't empty when you demo it on camera.
const seed = async () => {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');
    const passwordHash = await bcrypt.hash('password123', 10);

    const users = [
      { name: 'Admin User', email: 'admin@fundsroom.com', role: 'admin' },
      { name: 'Sales User', email: 'sales@fundsroom.com', role: 'sales' },
      { name: 'Warehouse User', email: 'warehouse@fundsroom.com', role: 'warehouse' },
      { name: 'Accounts User', email: 'accounts@fundsroom.com', role: 'accounts' },
    ];

    for (const u of users) {
      await client.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (email) DO NOTHING`,
        [u.name, u.email, passwordHash, u.role]
      );
    }
    console.log('Users seeded. All passwords: password123');

    const customers = [
      ['Ravi Kumar', '9876543210', 'ravi@example.com', 'Ravi Traders', 'Wholesale', 'Active'],
      ['Sneha Enterprises', '9876500000', 'sneha@example.com', 'Sneha Enterprises', 'Distributor', 'Active'],
      ['Local Retail Shop', '9123456789', null, 'Local Retail', 'Retail', 'Lead'],
    ];
    for (const c of customers) {
      await client.query(
        `INSERT INTO customers (customer_name, mobile_number, email, business_name, customer_type, status)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        c
      );
    }
    console.log('Sample customers seeded.');

    const products = [
      ['Steel Rod 12mm', 'SKU-STEEL-12', 'Construction', 550.00, 200, 20, 'Warehouse A'],
      ['Cement Bag 50kg', 'SKU-CEMENT-50', 'Construction', 380.00, 500, 50, 'Warehouse A'],
      ['PVC Pipe 2inch', 'SKU-PVC-2IN', 'Plumbing', 120.00, 15, 20, 'Warehouse B'], // deliberately low stock
    ];
    for (const p of products) {
      await client.query(
        `INSERT INTO products (product_name, sku, category, unit_price, current_stock, min_stock_alert, warehouse_location)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (sku) DO NOTHING`,
        p
      );
    }
    console.log('Sample products seeded.');

    console.log('Seeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

seed();
