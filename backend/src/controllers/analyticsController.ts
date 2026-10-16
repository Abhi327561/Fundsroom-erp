import { Request, Response } from 'express';
import { Customer, Product, Challan, StockMovement } from '../models/store';

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const dayLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// GET /analytics/dashboard — single payload powering all Dashboard graphs.
export const getDashboardAnalytics = async (_req: Request, res: Response) => {
  try {
    const [customers, products, challans, lowStock, invAgg] = await Promise.all([
      Customer.countDocuments(),
      Product.countDocuments(),
      Challan.countDocuments(),
      Product.countDocuments({ $expr: { $lte: ['$current_stock', '$min_stock_alert'] } }),
      Product.aggregate([{ $group: { _id: null, total: { $sum: { $multiply: ['$unit_price', '$current_stock'] } } } }]),
    ]);
    const draftChallans = await Challan.countDocuments({ status: 'Draft' });

    const [challansByStatus, customersByType, customersByStatus, stockByCategory] = await Promise.all([
      Challan.aggregate([{ $group: { _id: '$status', value: { $sum: 1 } } }]).then((r) =>
        r.map((x: any) => ({ name: x._id, value: x.value }))
      ),
      Customer.aggregate([{ $group: { _id: '$customer_type', value: { $sum: 1 } } }]).then((r) =>
        r.map((x: any) => ({ name: x._id, value: x.value }))
      ),
      Customer.aggregate([{ $group: { _id: '$status', value: { $sum: 1 } } }]).then((r) =>
        r.map((x: any) => ({ name: x._id, value: x.value }))
      ),
      Product.aggregate([
        {
          $group: {
            _id: { $ifNull: ['$category', 'Uncategorized'] },
            stock: { $sum: '$current_stock' },
            value: { $sum: { $multiply: ['$unit_price', '$current_stock'] } },
          },
        },
        { $sort: { value: -1 } },
      ]).then((r) => r.map((x: any) => ({ name: x._id || 'Uncategorized', stock: x.stock, value: x.value }))),
    ]);

    // Last-14-day series, bucketed in JS (portable across Mongo versions).
    const days: { key: string; day: string }[] = [];
    for (let s = 13; s >= 0; s--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - s);
      days.push({ key: dayKey(d), day: dayLabel(d) });
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 13);

    const [recentChallans, recentMovements] = await Promise.all([
      Challan.find({ created_at: { $gte: start } }).lean(),
      StockMovement.find({ created_at: { $gte: start } }).lean(),
    ]);

    const challansTrend = days.map(({ key, day }) => {
      const todays = recentChallans.filter((c: any) => dayKey(new Date(c.created_at)) === key);
      return {
        day,
        challans: todays.length,
        qty: todays.reduce((sum: number, c: any) => sum + (c.total_quantity || 0), 0),
      };
    });
    const movementsTrend = days.map(({ key, day }) => {
      const todays = recentMovements.filter((m: any) => dayKey(new Date(m.created_at)) === key);
      return {
        day,
        stock_in: todays.filter((m: any) => m.movement_type === 'IN').reduce((s: number, m: any) => s + m.quantity_changed, 0),
        stock_out: todays.filter((m: any) => m.movement_type === 'OUT').reduce((s: number, m: any) => s + m.quantity_changed, 0),
      };
    });

    const [lowStockList, recent] = await Promise.all([
      Product.find({ $expr: { $lte: ['$current_stock', '$min_stock_alert'] } })
        .sort({ current_stock: 1 })
        .limit(5)
        .lean(),
      Challan.find().sort({ created_at: -1 }).limit(6).lean(),
    ]);
    const custIds = [...new Set(recent.map((c: any) => String(c.customer_id)))];
    const custs = await Customer.find({ _id: { $in: custIds } }).lean();
    const cMap = new Map(custs.map((c: any) => [String(c._id), c.customer_name]));

    return res.status(200).json({
      stats: {
        customers,
        products,
        challans,
        draftChallans,
        lowStock,
        inventoryValue: invAgg[0]?.total ?? 0,
      },
      challansByStatus,
      customersByType,
      customersByStatus,
      stockByCategory,
      challansTrend,
      movementsTrend,
      lowStock: lowStockList.map((p: any) => ({
        id: String(p._id),
        product_name: p.product_name,
        sku: p.sku,
        current_stock: p.current_stock,
        min_stock_alert: p.min_stock_alert,
      })),
      recentChallans: recent.map((c: any) => ({
        id: String(c._id),
        challan_number: c.challan_number,
        customer_name: cMap.get(String(c.customer_id)) ?? null,
        status: c.status,
        total_quantity: c.total_quantity,
        created_at: c.created_at,
      })),
    });
  } catch (err) {
    console.error('dashboardAnalytics error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard analytics' });
  }
};
