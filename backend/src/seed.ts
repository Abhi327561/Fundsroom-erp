import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { env } from './config/env';
import { User, Customer, Product, StockMovement, Challan, Counter } from './models/store';

dotenv.config();

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

// Run with: npm run seed
// Idempotent demo seed: safe to re-run. Skips rows that already exist
// (users by email, products by SKU, customers by mobile, challans by number).
// Spreads challans + movements over the last 13 days so Dashboard graphs look alive.
const seed = async () => {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.mongoUri);
    console.log('Seeding database...');

    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Users — one per role
    const users = [
      { name: 'Admin User', email: 'admin@fundsroom.com', role: 'admin' },
      { name: 'Sales User', email: 'sales@fundsroom.com', role: 'sales' },
      { name: 'Warehouse User', email: 'warehouse@fundsroom.com', role: 'warehouse' },
      { name: 'Accounts User', email: 'accounts@fundsroom.com', role: 'accounts' },
    ];
    for (const u of users) {
      await User.updateOne(
        { email: u.email },
        { $setOnInsert: { name: u.name, email: u.email, password_hash: passwordHash, role: u.role } },
        { upsert: true }
      );
    }
    console.log('Users seeded. All passwords: password123');

    const admin = await User.findOne({ email: 'admin@fundsroom.com' });
    const sales = (await User.findOne({ email: 'sales@fundsroom.com' })) ?? admin;

    // 2. Customers — 14 across types + statuses (skip if mobile already exists)
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
      const exists = await Customer.exists({ mobile_number: c[1] });
      if (exists) continue;
      const followUp = c[8] === null || c[8] === undefined ? null : (() => { const d = new Date(); d.setDate(d.getDate() + Number(c[8])); return d; })();
      await Customer.create({
        customer_name: c[0], mobile_number: c[1], email: c[2], business_name: c[3], gst_number: c[4],
        customer_type: c[5], address: c[6], status: c[7], follow_up_date: followUp, notes: c[9],
      });
      customersAdded++;
    }
    console.log(`Customers seeded (+${customersAdded} new).`);

    // 3. Products — 16 across 5 categories (idempotent by SKU)
    const products: any[][] = [
      ['Steel Rod 12mm', 'SKU-STEEL-12', 'Construction', 550.0, 200, 20, 'Warehouse A'],
      ['Steel Rod 8mm', 'SKU-STEEL-08', 'Construction', 480.0, 12, 30, 'Warehouse A'],
      ['Cement Bag 50kg', 'SKU-CEMENT-50', 'Construction', 380.0, 500, 50, 'Warehouse A'],
      ['Concrete Block 6inch', 'SKU-BLOCK-06', 'Construction', 65.0, 1200, 200, 'Yard'],
      ['PVC Pipe 2inch', 'SKU-PVC-2IN', 'Plumbing', 120.0, 15, 20, 'Warehouse B'],
      ['CPVC Pipe 1inch', 'SKU-CPVC-1IN', 'Plumbing', 95.0, 220, 40, 'Warehouse B'],
      ['Brass Tap Deluxe', 'SKU-TAP-BR01', 'Plumbing', 750.0, 8, 15, 'Warehouse B'],
      ['UPVC Elbow 2inch (pack of 10)', 'SKU-ELBOW-2IN', 'Plumbing', 210.0, 150, 30, 'Warehouse B'],
      ['Copper Wire 1.5sqmm 90m', 'SKU-WIRE-15', 'Electrical', 1850.0, 60, 10, 'Warehouse C'],
      ['LED Panel 12W (pack of 4)', 'SKU-LED-12W', 'Electrical', 640.0, 9, 20, 'Warehouse C'],
      ['MCB 32A Single Pole', 'SKU-MCB-32A', 'Electrical', 320.0, 110, 25, 'Warehouse C'],
      ['Switch Board 8M', 'SKU-SW-08M', 'Electrical', 450.0, 75, 15, 'Warehouse C'],
      ['Premium Emulsion 4L White', 'SKU-PAINT-EM4', 'Paints', 980.0, 85, 20, 'Warehouse A'],
      ['Waterproof Primer 1L', 'SKU-PRIMER-1L', 'Paints', 260.0, 6, 25, 'Warehouse A'],
      ['Hammer 500g', 'SKU-HAM-500', 'Hardware', 340.0, 140, 20, 'Warehouse C'],
      ['Drill Machine 13mm', 'SKU-DRILL-13', 'Hardware', 2450.0, 18, 8, 'Warehouse C'],
    ];
    let productsAdded = 0;
    for (const p of products) {
      const r = await Product.updateOne(
        { sku: p[1] },
        {
          $setOnInsert: {
            product_name: p[0], sku: p[1], category: p[2], unit_price: p[3],
            current_stock: p[4], min_stock_alert: p[5], warehouse_location: p[6],
          },
        },
        { upsert: true }
      );
      if (r.upsertedCount) productsAdded++;
    }
    console.log(`Products seeded (+${productsAdded} new).`);

    // 4. Opening-stock movements for products with no history yet
    const prods = await Product.find({});
    let movementsAdded = 0;
    for (const p of prods) {
      const has = await StockMovement.exists({ product_id: p._id });
      if (has || p.current_stock <= 0) continue;
      await StockMovement.create({
        product_id: p._id, quantity_changed: p.current_stock, movement_type: 'IN',
        reason: 'Opening stock (seed)', created_by: admin!._id, created_at: daysAgo(Math.floor(Math.random() * 20)),
      });
      movementsAdded++;
    }
    console.log(`Opening stock movements (+${movementsAdded}).`);

    // 5. Demo challans spread over 12 days — mix of Draft / Confirmed / Cancelled
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
      if (await Challan.exists({ challan_number: ch.no })) continue;
      const cust = await Customer.findOne({ mobile_number: ch.mobile });
      if (!cust) { console.log(`Skip ${ch.no}: customer ${ch.mobile} missing`); continue; }

      try {
        const lines: { productId: any; qty: number; name: string; price: number }[] = [];
        let totalQty = 0;
        for (const [sku, qty] of ch.items) {
          const pr: any = await Product.findOne({ sku });
          if (!pr) throw new Error(`product ${sku} missing`);
          if (ch.status === 'Confirmed' && qty > pr.current_stock) {
            throw new Error(`insufficient stock for ${sku}: have ${pr.current_stock}, need ${qty}`);
          }
          lines.push({ productId: pr._id, qty, name: pr.product_name, price: pr.unit_price });
          totalQty += qty;
        }

        const challan = await Challan.create({
          challan_number: ch.no, customer_id: cust._id, total_quantity: totalQty,
          status: ch.status, created_by: ch.status === 'Draft' ? sales!._id : admin!._id,
          created_at: daysAgo(ch.daysAgo),
          items: lines.map((l) => ({
            product_id: l.productId, product_name_snapshot: l.name, unit_price_snapshot: l.price, quantity: l.qty,
          })),
        });

        if (ch.status === 'Confirmed') {
          for (const l of lines) {
            await Product.updateOne({ _id: l.productId }, { $inc: { current_stock: -l.qty } });
            await StockMovement.create({
              product_id: l.productId, quantity_changed: l.qty, movement_type: 'OUT',
              reason: `Sales Challan ${ch.no}`, created_by: admin!._id, created_at: daysAgo(ch.daysAgo),
            });
          }
        }
        // Keep the yearly counter ahead of seeded numbers so generated numbers stay unique.
        await Counter.updateOne({ year: 2026 }, { $max: { seq: 900108 } }, { upsert: true });
        void challan;
        challansAdded++;
      } catch (e) {
        console.error(`Skip ${ch.no}:`, (e as Error).message);
      }
    }
    // Ensure future generated numbers don't collide with anything already present.
    console.log(`Demo challans (+${challansAdded} new).`);

    const [c, p, ch, m] = await Promise.all([
      Customer.countDocuments(), Product.countDocuments(), Challan.countDocuments(), StockMovement.countDocuments(),
    ]);
    console.log('Totals:', { customers: c, products: p, challans: ch, movements: m });
    console.log('Seeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await mongoose.disconnect();
  }
};

seed();
