import { Request, Response } from 'express';
import { pool } from '../config/db';

// GET /products?search=&category=&lowStock=true&page=&limit=
export const getProducts = async (req: Request, res: Response) => {
  try {
    const { search = '', category, lowStock, page = '1', limit = '10' } = req.query;
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const limitNum = Math.max(parseInt(limit as string) || 10, 1);
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const values: any[] = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(product_name ILIKE $${values.length} OR sku ILIKE $${values.length})`);
    }
    if (category) {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }
    if (lowStock === 'true') {
      conditions.push(`current_stock <= min_stock_alert`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM products ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count);

    values.push(limitNum, offset);
    const result = await pool.query(
      `SELECT * FROM products ${whereClause} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return res.status(200).json({
      data: result.rows,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('getProducts error:', err);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
};

// GET /products/:id
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    console.error('getProductById error:', err);
    return res.status(500).json({ error: 'Failed to fetch product' });
  }
};

// POST /products
export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      product_name, sku, category, unit_price,
      current_stock, min_stock_alert, warehouse_location,
    } = req.body;

    if (!product_name || !sku || unit_price === undefined) {
      return res.status(400).json({ error: 'product_name, sku and unit_price are required' });
    }
    if (unit_price < 0) {
      return res.status(400).json({ error: 'unit_price cannot be negative' });
    }

    const result = await pool.query(
      `INSERT INTO products
        (product_name, sku, category, unit_price, current_stock, min_stock_alert, warehouse_location)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [product_name, sku, category || null, unit_price,
       current_stock || 0, min_stock_alert || 0, warehouse_location || null]
    );

    return res.status(201).json({ data: result.rows[0] });
  } catch (err: any) {
    if (err.code === '23505') { // Postgres unique violation (duplicate SKU)
      return res.status(409).json({ error: 'A product with this SKU already exists' });
    }
    console.error('createProduct error:', err);
    return res.status(500).json({ error: 'Failed to create product' });
  }
};

// PUT /products/:id  (does NOT change current_stock directly -- use /stock-movements for that)
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { product_name, category, unit_price, min_stock_alert, warehouse_location } = req.body;

    const existing = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const result = await pool.query(
      `UPDATE products SET
        product_name = COALESCE($1, product_name),
        category = COALESCE($2, category),
        unit_price = COALESCE($3, unit_price),
        min_stock_alert = COALESCE($4, min_stock_alert),
        warehouse_location = COALESCE($5, warehouse_location),
        updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [product_name, category, unit_price, min_stock_alert, warehouse_location, id]
    );

    return res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    console.error('updateProduct error:', err);
    return res.status(500).json({ error: 'Failed to update product' });
  }
};

// POST /products/:id/stock-movements  -> adjust stock with an audit trail entry
// This is the ONLY way stock should change outside of challan confirmation.
export const addStockMovement = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { quantity_changed, movement_type, reason } = req.body;
    const userId = req.user?.id;

    if (!quantity_changed || quantity_changed <= 0) {
      return res.status(400).json({ error: 'quantity_changed must be a positive number' });
    }
    if (!['IN', 'OUT'].includes(movement_type)) {
      return res.status(400).json({ error: 'movement_type must be IN or OUT' });
    }

    await client.query('BEGIN');

    const productResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [id]);
    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = productResult.rows[0];

    const newStock = movement_type === 'IN'
      ? product.current_stock + quantity_changed
      : product.current_stock - quantity_changed;

    if (newStock < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient stock for this OUT movement' });
    }

    await client.query('UPDATE products SET current_stock = $1, updated_at = NOW() WHERE id = $2', [newStock, id]);

    const movementResult = await client.query(
      `INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, quantity_changed, movement_type, reason || null, userId]
    );

    await client.query('COMMIT');
    return res.status(201).json({ data: movementResult.rows[0], new_stock: newStock });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('addStockMovement error:', err);
    return res.status(500).json({ error: 'Failed to record stock movement' });
  } finally {
    client.release();
  }
};

// GET /products/:id/stock-movements
export const getStockMovements = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT sm.*, u.name as created_by_name
       FROM stock_movements sm
       LEFT JOIN users u ON sm.created_by = u.id
       WHERE sm.product_id = $1
       ORDER BY sm.created_at DESC`,
      [id]
    );
    return res.status(200).json({ data: result.rows });
  } catch (err) {
    console.error('getStockMovements error:', err);
    return res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
};
