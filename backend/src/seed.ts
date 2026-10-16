import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { pool } from './config/db';

dotenv.config();

// Run with: npm run seed
// Idempotent demo seed: safe to re-run. Skips rows that already exist
// (users/products by unique email/sku, customers by mobile, challans by number).
// Spreads challans + movements over the last 13 days so Dashboard graphs look alive.
const seed = async () => {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    // 0. Ensure schema exists (first-run safety)
    const schemaPath = path.join(__dirname, 'config', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      // CREATE TABLE without IF NOT EXISTS will throw if tables exist — ignore that case.
      const guarded = schema.replace(/CREATE TABLE (\w+)/g, 'CREATE TABLE IF NOT EXISTS $1');
      await client.query(guarded);
    }

    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Users — one per role
    const users = [
      { name: 'Admin User', email: 'admin@fundsroom.com', role: 'admin' },
      { name: 'Sales User', email: 'sales@fundsroom.com', role: 'sales' },
      { name: 'Warehouse User', email: 'warehouse@fundsroom.com', role: 'warehouse' },
      { name: 'Accounts User', email: 'accounts@fundsroom.com', role: 'accounts' },
    ];
    for (const u of users) {
      await client.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING`,
        [u.name, u.email, passwordHash, u.role]
      );
    }
    console.log('Users seeded. All passwords: password123');

    const adminId = (await client.query(`SELECT id FROM users WHERE email='admin@fundsroom.com'`)).rows[0]?.id;
    const salesId = (await client.query(`SELECT id FROM users WHERE email='sales@fundsroom.com'`)).rows[0]?.id ?? adminId;

    // 2. Customers — 14 across types + statuses (skip if mobile already exists)
    // [name, mobile, email, business, gst, type, address, status, followUpDaysFromNow|null, notes]
    const customers: any[][] = [
      ['Ravi Kumar', '9876543210', 'ravi@example.com', 'Ravi Traders', '27ABCDE1234F1Z5', 'Wholesale', 'Shop 12, APMC Market, Navi Mumbai', 'Active', null, 'Pays on time, prefers delivery mornings'],
      ['Sneha Enterprises', '9876500000', 'sneha@example.com', 'Sneha Enterprises', '27ABCDE5678G1Z5', 'Distributor', 'Plot 8, MIDC Bhosari, Pune', 'Active', 3, 'Quarterly contract renewal due'],
      ['Local Retail Shop', '9123456789', null, 'Local Retail', null, 'Retail', 'Main Road, Shirva', 'Lead', 2, 'Visited once, asked for price list'],
      ['Amit Patel', '9812345670', 'amit@patelhardware.com', 'Patel Hardware', '24ABCDE9012H1Z5', 'Retail', 'Station Road, Ahmedabad', 'Active', null, null],
      ['Kavitha Stores', '9901234567', 'kavitha@stores.com', 'Kavitha Stores', null, 'Retail', 'MG Road, Bengaluru', 'Active', 5, 'Wants credit limit increase'],
      ['Sharma Building Mart', '9811122233', 'sales@sharmamart.com', 'Sharma Building Mart', '07ABCDE3456J1Z5', 'Wholesale', 'Khanna Market, Delhi', 'Active', null, 'Bulk cement buyer'],
      ['Coastal Distributors', '9845012345', 'ops@coastaldist.com', 'Coastal Distributors LLP', '29ABCDE7890K1Z5', 'Distributor', 'Port Road, Mangaluru', 'Active', 7, 'Covers 40 retail outlets'],
      ['GreenLeaf Constructions', '9742011122', 'purchase@greenleaf.com', 'GreenLeaf Constructions', '29ABCDE1122L1Z5', 'Wholesale', 'Whitefield, Bengaluru', 'Lead', 4, 'New site starting next month, big potential'],
      ['Farhan Traders', '9833004455', 'farhan@traders.com', 'Farhan Traders', null, 'Wholesale', 'Crawford Market, Mumbai', 'Inactive', null, 'Dormant since March'],
      ['Priya Electricals', '9886077888', 'priya@electricals.com', 'Priya Electricals', '29ABCDE3344M1Z5', 'Retail', 'SP Road, Bengaluru', 'Active', null, null],
      ['Namma Paints & Plywood', '9731010101', 'hello@nammapaints.com', 'Namma Paints & Plywood', null, 'Retail', 'HSR Layout, Bengaluru', 'Lead', 1, 'Asked for paint shade cards'],
      ['Vijay Sanitaryware', '9845009988', 'vijay@sanitary.com', 'Vijay Sanitaryware', '29ABCDE5566N1Z5', 'Distributor', 'Chickpet, Bengaluru', 'Active', 6, null],
      ['Sunrise Developers', '9820065432', 'projects@sunrise.com', 'Sunrise Developers', '27ABCDE7788P1Z5', 'Wholesale', 'Thane West', 'Active', null, '3 ongoing sites'],
      ['Small Corner Shop', '9000011111', null, 'Corner Shop', null, 'Retail', 'Udupi', 'Inactive', null, 'One-time buyer'],
    ];
    let customersAdded = 0;
    for (const c of customers) {
      const exists = await client.query(`SELECT id FROM customers WHERE mobile_number = $1`, [c[1]]);
      if (exists.rows.length > 0) continue;
      await client.query(
        `INSERT INTO customers (customer_name, mobile_number, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CURRENT_DATE + ($9 || ' days')::interval, $10)`,
        c
      );
      customersAdded++;
    }
    console.log(`Customers seeded (+${customersAdded} new).`);

    // 3. Products — 16 across 5 categories (idempotent by SKU)
    // [name, sku, category, price, stock, alert, location]
    const products: any[][] = [
      ['Steel Rod 12mm', 'SKU-STEEL-12', 'Construction', 550.0, 200, 20, 'Warehouse A'],
      ['Steel Rod 8mm', 'SKU-STEEL-08', 'Construction', 480.0, 12, 30, 'Warehouse A'], // low
      ['Cement Bag 50kg', 'SKU-CEMENT-50', 'Construction', 380.0, 500, 50, 'Warehouse A'],
      ['Concrete Block 6inch', 'SKU-BLOCK-06', 'Construction', 65.0, 1200, 200, 'Yard'],
      ['PVC Pipe 2inch', 'SKU-PVC-2IN', 'Plumbing', 120.0, 15, 20, 'Warehouse B'], // low
      ['CPVC Pipe 1inch', 'SKU-CPVC-1IN', 'Plumbing', 95.0, 220, 40, 'Warehouse B'],
      ['Brass Tap Deluxe', 'SKU-TAP-BR01', 'Plumbing', 750.0, 8, 15, 'Warehouse B'], // low
      ['UPVC Elbow 2inch (pack of 10)', 'SKU-ELBOW-2IN', 'Plumbing', 210.0, 150, 30, 'Warehouse B'],
      ['Copper Wire 1.5sqmm 90m', 'SKU-WIRE-15', 'Electrical', 1850.0, 60, 10, 'Warehouse C'],
      ['LED Panel 12W (pack of 4)', 'SKU-LED-12W', 'Electrical', 640.0, 9, 20, 'Warehouse C'], // low
      ['MCB 32A Single Pole', 'SKU-MCB-32A', 'Electrical', 320.0, 110, 25, 'Warehouse C'],
      ['Switch Board 8M', 'SKU-SW-08M', 'Electrical', 450.0, 75, 15, 'Warehouse C'],
      ['Premium Emulsion 4L White', 'SKU-PAINT-EM4', 'Paints', 980.0, 85, 20, 'Warehouse A'],
      ['Waterproof Primer 1L', 'SKU-PRIMER-1L', 'Paints', 260.0, 6, 25, 'Warehouse A'], // low
      ['Hammer 500g', 'SKU-HAM-500', 'Hardware', 340.0, 140, 20, 'Warehouse C'],
      ['Drill Machine 13mm', 'SKU-DRILL-13', 'Hardware', 2450.0, 18, 8, 'Warehouse C'],
    ];
    let productsAdded = 0;
    for (const p of products) {
      const r = await client.query(
        `INSERT INTO products (product_name, sku, category, unit_price, current_stock, min_stock_alert, warehouse_location)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (sku) DO NOTHING`,
        p
      );
      if (r.rowCount) productsAdded++;
    }
    console.log(`Products seeded (+${productsAdded} new).`);

    // 4. Opening-stock movements for products that have no history yet
    const prods = (await client.query(`SELECT id, product_name FROM products`)).rows;
    let movementsAdded = 0;
    for (const p of prods) {
      const has = await client.query(`SELECT id FROM stock_movements WHERE product_id = $1 LIMIT 1`, [p.id]);
      if (has.rows.length > 0) continue;
      const stock = (await client.query(`SELECT current_stock FROM products WHERE id = $1`, [p.id])).rows[0].current_stock;
      if (stock > 0) {
        await client.query(
          `INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, created_by, created_at)
           VALUES ($1,$2,'IN','Opening stock (seed)',$3, NOW() - (random() * 20 || ' days')::interval)`,
          [p.id, stock, adminId]
        );
        movementsAdded++;
      }
    }
    console.log(`Opening stock movements (+${movementsAdded}).`);

    // 5. Demo challans spread over 13 days — mix of Draft / Confirmed / Cancelled
    // [challanNumber, customerMobile, status, daysAgo, items: [sku, qty][]]
    const challans: { no: string; mobile: string; status: string; daysAgo: number; items: [string, number][] }[] = [
      { no: 'CH-2026-900101', mobile: '9876543210', status: 'Confirmed', daysAgo: 12, items: [['SKU-CEMENT-50', 20], ['SKU-STEEL-12', 10]] },
      { no: 'CH-2026-900102', mobile: '9845012345', status: 'Confirmed', daysAgo: 10, items: [['SKU-PVC-2IN', 5], ['SKU-ELBOW-2IN', 10]] },
      { no: 'CH-2026-900103', mobile: '9811122233', status: 'Confirmed', daysAgo: 8, items: [['SKU-CEMENT-50', 50]] },
      { no: 'CH-2026-900104', mobile: '9886077888', status: 'Confirmed', daysAgo: 6, items: [['SKU-WIRE-15', 4], ['SKU-MCB-32A', 10]] },
      { no: 'CH-2026-900105', mobile: '9876500000', status: 'Draft', daysAgo: 4, items: [['SKU-PAINT-EM4', 6], ['SKU-PRIMER-1L', 4]] },
      { no: 'CH-2026-900106', mobile: '9742011122', status: 'Draft', daysAgo: 2, items: [['SKU-BLOCK-06', 100]] },
      { no: 'CH-2026-900107', mobile: '9845009988', status: 'Confirmed', daysAgo: 1, items: [['SKU-TAP-BR01', 2], ['SKU-CPVC-1IN', 15]] },
      { no: 'CH-2026-900108', mobile: '9820065432', status: 'Cancelled', daysAgo: 3, items: [['SKU-HAM-500', 5]] },
    ];
    let challansAdded = 0;
    for (const ch of challans) {
      const exists = await client.query(`SELECT id FROM challans WHERE challan_number = $1`, [ch.no]);
      if (exists.rows.length > 0) continue;

      const cust = (await client.query(`SELECT id FROM customers WHERE mobile_number = $1`, [ch.mobile])).rows[0];
      if (!cust) { console.log(`Skip ${ch.no}: customer ${ch.mobile} missing`); continue; }

      await client.query('BEGIN');
      try {
        const prodRows = [];
        let totalQty = 0;
        for (const [sku, qty] of ch.items) {
          const pr = (await client.query(`SELECT * FROM products WHERE sku = $1 FOR UPDATE`, [sku])).rows[0];
          if (!pr) throw new Error(`product ${sku} missing`);
          if (ch.status === 'Confirmed' && qty > pr.current_stock) {
            throw new Error(`insufficient stock for ${sku}: have ${pr.current_stock}, need ${qty}`);
          }
          prodRows.push({ ...pr, qty });
          totalQty += qty;
        }

        const chRes = await client.query(
          `INSERT INTO challans (challan_number, customer_id, total_quantity, status, created_by, created_at)
           VALUES ($1,$2,$3,$4,$5, NOW() - ($6 || ' days')::interval) RETURNING *`,
          [ch.no, cust.id, totalQty, ch.status, ch.status === 'Draft' ? salesId : adminId, String(ch.daysAgo)]
        );
        const challan = chRes.rows[0];

        for (const pr of prodRows) {
          await client.query(
            `INSERT INTO challan_items (challan_id, product_id, product_name_snapshot, unit_price_snapshot, quantity)
             VALUES ($1,$2,$3,$4,$5)`,
            [challan.id, pr.id, pr.product_name, pr.unit_price, pr.qty]
          );
          if (ch.status === 'Confirmed') {
            const newStock = pr.current_stock - pr.qty;
            await client.query(`UPDATE products SET current_stock = $1, updated_at = NOW() WHERE id = $2`, [newStock, pr.id]);
            await client.query(
              `INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, created_by, created_at)
               VALUES ($1,$2,'OUT',$3,$4, NOW() - ($5 || ' days')::interval)`,
              [pr.id, pr.qty, `Sales Challan ${ch.no}`, adminId, String(ch.daysAgo)]
            );
          }
        }

        await client.query('COMMIT');
        challansAdded++;
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`Skip ${ch.no}:`, (e as Error).message);
      }
    }
    console.log(`Demo challans (+${challansAdded} new).`);

    const counts = await client.query(`
      SELECT (SELECT COUNT(*) FROM customers) AS customers,
             (SELECT COUNT(*) FROM products) AS products,
             (SELECT COUNT(*) FROM challans) AS challans,
             (SELECT COUNT(*) FROM stock_movements) AS movements
    `);
    console.log('Totals:', counts.rows[0]);
    console.log('Seeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

seed();
