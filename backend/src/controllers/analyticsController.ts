import { Request, Response } from 'express';
import { pool } from '../config/db';

// GET /analytics/dashboard — single payload powering all Dashboard graphs.
// Keeps the frontend to 1 request instead of 6+.
export const getDashboardAnalytics = async (_req: Request, res: Response) => {
  try {
    const [
      counts,
      challansByStatus,
      customersByType,
      customersByStatus,
      stockByCategory,
      challansTrend,
      movementsTrend,
      lowStock,
      recentChallans,
    ] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM customers) AS customers,
          (SELECT COUNT(*) FROM products) AS products,
          (SELECT COUNT(*) FROM challans) AS challans,
          (SELECT COUNT(*) FROM challans WHERE status = 'Draft') AS draft_challans,
          (SELECT COUNT(*) FROM products WHERE current_stock <= min_stock_alert) AS low_stock,
          (SELECT COALESCE(SUM(unit_price * current_stock), 0) FROM products) AS inventory_value
      `),
      pool.query(`SELECT status AS name, COUNT(*)::int AS value FROM challans GROUP BY status`),
      pool.query(`SELECT customer_type AS name, COUNT(*)::int AS value FROM customers GROUP BY customer_type`),
      pool.query(`SELECT status AS name, COUNT(*)::int AS value FROM customers GROUP BY status`),
      pool.query(`
        SELECT COALESCE(NULLIF(category, ''), 'Uncategorized') AS name,
               COALESCE(SUM(current_stock), 0)::int AS stock,
               COALESCE(SUM(unit_price * current_stock), 0)::float AS value
        FROM products GROUP BY category ORDER BY value DESC
      `),
      pool.query(`
        SELECT TO_CHAR(d.day, 'Mon DD') AS day,
               COUNT(c.id)::int AS challans,
               COALESCE(SUM(c.total_quantity), 0)::int AS qty
        FROM (SELECT CURRENT_DATE - s AS day FROM generate_series(0, 13) s) d
        LEFT JOIN challans c ON DATE(c.created_at) = d.day
        GROUP BY d.day ORDER BY MIN(d.day)
      `),
      pool.query(`
        SELECT TO_CHAR(d.day, 'Mon DD') AS day,
               COALESCE(SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity_changed ELSE 0 END), 0)::int AS stock_in,
               COALESCE(SUM(CASE WHEN sm.movement_type = 'OUT' THEN sm.quantity_changed ELSE 0 END), 0)::int AS stock_out
        FROM (SELECT CURRENT_DATE - s AS day FROM generate_series(0, 13) s) d
        LEFT JOIN stock_movements sm ON DATE(sm.created_at) = d.day
        GROUP BY d.day ORDER BY MIN(d.day)
      `),
      pool.query(`
        SELECT id, product_name, sku, current_stock, min_stock_alert, category
        FROM products ORDER BY current_stock ASC LIMIT 5
      `),
      pool.query(`
        SELECT c.id, c.challan_number, c.status, c.total_quantity, c.created_at, cu.customer_name
        FROM challans c LEFT JOIN customers cu ON c.customer_id = cu.id
        ORDER BY c.created_at DESC LIMIT 6
      `),
    ]);

    return res.status(200).json({
      stats: {
        customers: parseInt(counts.rows[0].customers),
        products: parseInt(counts.rows[0].products),
        challans: parseInt(counts.rows[0].challans),
        draftChallans: parseInt(counts.rows[0].draft_challans),
        lowStock: parseInt(counts.rows[0].low_stock),
        inventoryValue: parseFloat(counts.rows[0].inventory_value),
      },
      challansByStatus: challansByStatus.rows,
      customersByType: customersByType.rows,
      customersByStatus: customersByStatus.rows,
      stockByCategory: stockByCategory.rows,
      challansTrend: challansTrend.rows,
      movementsTrend: movementsTrend.rows,
      lowStock: lowStock.rows,
      recentChallans: recentChallans.rows,
    });
  } catch (err) {
    console.error('dashboardAnalytics error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard analytics' });
  }
};
