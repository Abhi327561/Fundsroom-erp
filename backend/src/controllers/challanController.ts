import { Request, Response } from 'express';
import { pool } from '../config/db';

// Generates a challan number like CH-2026-000123
const generateChallanNumber = async (client: any): Promise<string> => {
  const year = new Date().getFullYear();
  const result = await client.query(
    `SELECT COUNT(*) FROM challans WHERE challan_number LIKE $1`,
    [`CH-${year}-%`]
  );
  const nextSeq = parseInt(result.rows[0].count) + 1;
  return `CH-${year}-${String(nextSeq).padStart(6, '0')}`;
};

// GET /challans?status=&customer_id=&page=&limit=
export const getChallans = async (req: Request, res: Response) => {
  try {
    const { status, customer_id, page = '1', limit = '10' } = req.query;
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const limitNum = Math.max(parseInt(limit as string) || 10, 1);
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const values: any[] = [];

    if (status) {
      values.push(status);
      conditions.push(`c.status = $${values.length}`);
    }
    if (customer_id) {
      values.push(customer_id);
      conditions.push(`c.customer_id = $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM challans c ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count);

    values.push(limitNum, offset);
    const result = await pool.query(
      `SELECT c.*, cu.customer_name, u.name as created_by_name
       FROM challans c
       LEFT JOIN customers cu ON c.customer_id = cu.id
       LEFT JOIN users u ON c.created_by = u.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return res.status(200).json({
      data: result.rows,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('getChallans error:', err);
    return res.status(500).json({ error: 'Failed to fetch challans' });
  }
};

// GET /challans/:id  -> includes line items
export const getChallanById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const challanResult = await pool.query(
      `SELECT c.*, cu.customer_name, cu.mobile_number, u.name as created_by_name
       FROM challans c
       LEFT JOIN customers cu ON c.customer_id = cu.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = $1`,
      [id]
    );
    if (challanResult.rows.length === 0) {
      return res.status(404).json({ error: 'Challan not found' });
    }

    const itemsResult = await pool.query('SELECT * FROM challan_items WHERE challan_id = $1', [id]);

    return res.status(200).json({
      data: { ...challanResult.rows[0], items: itemsResult.rows },
    });
  } catch (err) {
    console.error('getChallanById error:', err);
    return res.status(500).json({ error: 'Failed to fetch challan' });
  }
};

// POST /challans  -> create as Draft (no stock impact yet)
// body: { customer_id, status: 'Draft' | 'Confirmed', items: [{ product_id, quantity }] }
export const createChallan = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { customer_id, status = 'Draft', items } = req.body;
    const userId = req.user?.id;

    if (!customer_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'customer_id and at least one item are required' });
    }
    if (!['Draft', 'Confirmed'].includes(status)) {
      return res.status(400).json({ error: 'status must be Draft or Confirmed' });
    }

    await client.query('BEGIN');

    // Verify customer exists
    const customerCheck = await client.query('SELECT id FROM customers WHERE id = $1', [customer_id]);
    if (customerCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Customer does not exist' });
    }

    // Fetch and lock all involved products at once (prevents race conditions
    // if two challans for the same product are confirmed simultaneously)
    const productIds = items.map((item: any) => item.product_id);
    const productsResult = await client.query(
      `SELECT * FROM products WHERE id = ANY($1::int[]) FOR UPDATE`,
      [productIds]
    );
    const productsMap = new Map(productsResult.rows.map((p: any) => [p.id, p]));

    // Validate every product exists and, if confirming now, that stock is sufficient
    let totalQuantity = 0;
    for (const item of items) {
      const product = productsMap.get(item.product_id);
      if (!product) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Product ID ${item.product_id} does not exist` });
      }
      if (!item.quantity || item.quantity <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid quantity for product ${product.product_name}` });
      }
      if (status === 'Confirmed' && item.quantity > product.current_stock) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Insufficient stock for "${product.product_name}". Available: ${product.current_stock}, requested: ${item.quantity}`,
        });
      }
      totalQuantity += item.quantity;
    }

    const challanNumber = await generateChallanNumber(client);

    const challanResult = await client.query(
      `INSERT INTO challans (challan_number, customer_id, total_quantity, status, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [challanNumber, customer_id, totalQuantity, status, userId]
    );
    const challan = challanResult.rows[0];

    // Insert line items with a SNAPSHOT of product name/price at this moment
    for (const item of items) {
      const product = productsMap.get(item.product_id);
      await client.query(
        `INSERT INTO challan_items (challan_id, product_id, product_name_snapshot, unit_price_snapshot, quantity)
         VALUES ($1,$2,$3,$4,$5)`,
        [challan.id, product.id, product.product_name, product.unit_price, item.quantity]
      );

      // If confirming immediately, reduce stock and log the movement
      if (status === 'Confirmed') {
        const newStock = product.current_stock - item.quantity;
        await client.query('UPDATE products SET current_stock = $1, updated_at = NOW() WHERE id = $2', [newStock, product.id]);
        await client.query(
          `INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, created_by)
           VALUES ($1,$2,'OUT',$3,$4)`,
          [product.id, item.quantity, `Sales Challan ${challanNumber}`, userId]
        );
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({ data: challan });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createChallan error:', err);
    return res.status(500).json({ error: 'Failed to create challan' });
  } finally {
    client.release();
  }
};

// PATCH /challans/:id/confirm  -> move a Draft challan to Confirmed, reduce stock
export const confirmChallan = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    await client.query('BEGIN');

    const challanResult = await client.query('SELECT * FROM challans WHERE id = $1 FOR UPDATE', [id]);
    if (challanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Challan not found' });
    }
    const challan = challanResult.rows[0];

    if (challan.status !== 'Draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Only Draft challans can be confirmed. Current status: ${challan.status}` });
    }

    const itemsResult = await client.query('SELECT * FROM challan_items WHERE challan_id = $1', [id]);

    // Lock and validate stock for every item BEFORE changing anything
    const productIds = itemsResult.rows.map((i: any) => i.product_id);
    const productsResult = await client.query(`SELECT * FROM products WHERE id = ANY($1::int[]) FOR UPDATE`, [productIds]);
    const productsMap = new Map(productsResult.rows.map((p: any) => [p.id, p]));

    for (const item of itemsResult.rows) {
      const product = productsMap.get(item.product_id);
      if (!product || item.quantity > product.current_stock) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Insufficient stock for "${item.product_name_snapshot}". Available: ${product?.current_stock ?? 0}, requested: ${item.quantity}`,
        });
      }
    }

    // All checks passed -> reduce stock and log movements
    for (const item of itemsResult.rows) {
      const product = productsMap.get(item.product_id);
      const newStock = product.current_stock - item.quantity;
      await client.query('UPDATE products SET current_stock = $1, updated_at = NOW() WHERE id = $2', [newStock, product.id]);
      await client.query(
        `INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, created_by)
         VALUES ($1,$2,'OUT',$3,$4)`,
        [product.id, item.quantity, `Sales Challan ${challan.challan_number}`, userId]
      );
    }

    const updatedChallan = await client.query(
      `UPDATE challans SET status = 'Confirmed' WHERE id = $1 RETURNING *`,
      [id]
    );

    await client.query('COMMIT');
    return res.status(200).json({ data: updatedChallan.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('confirmChallan error:', err);
    return res.status(500).json({ error: 'Failed to confirm challan' });
  } finally {
    client.release();
  }
};

// PATCH /challans/:id/cancel
export const cancelChallan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const challanResult = await pool.query('SELECT * FROM challans WHERE id = $1', [id]);
    if (challanResult.rows.length === 0) {
      return res.status(404).json({ error: 'Challan not found' });
    }
    if (challanResult.rows[0].status === 'Cancelled') {
      return res.status(400).json({ error: 'Challan is already cancelled' });
    }

    // Note: if it was Confirmed, a real system would restock here.
    // Kept simple for this case study -- documented as a known limitation.
    const result = await pool.query(`UPDATE challans SET status = 'Cancelled' WHERE id = $1 RETURNING *`, [id]);
    return res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    console.error('cancelChallan error:', err);
    return res.status(500).json({ error: 'Failed to cancel challan' });
  }
};
