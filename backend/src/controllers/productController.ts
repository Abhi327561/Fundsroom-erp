import { Request, Response } from 'express';
import { Product, StockMovement, Challan, User, toClient, isId } from '../models/store';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pageParams = (req: Request, def = 10) => {
  const pageNum = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(req.query.limit as string) || def, 1), 100);
  return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
};

// GET /products?search=&category=&lowStock=true&page=&limit=
export const getProducts = async (req: Request, res: Response) => {
  try {
    const { search = '', category, lowStock } = req.query;
    const { pageNum, limitNum, skip } = pageParams(req);

    const filter: any = {};
    if (search) {
      const rx = new RegExp(escapeRegExp(String(search)), 'i');
      filter.$or = [{ product_name: rx }, { sku: rx }];
    }
    if (category) filter.category = category;
    if (lowStock === 'true') filter.$expr = { $lte: ['$current_stock', '$min_stock_alert'] };

    const [total, rows] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort({ created_at: -1 }).skip(skip).limit(limitNum).lean(),
    ]);

    return res.status(200).json({
      data: rows.map(toClient),
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
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Product not found' });
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.status(200).json({ data: toClient(product) });
  } catch (err) {
    console.error('getProductById error:', err);
    return res.status(500).json({ error: 'Failed to fetch product' });
  }
};

// POST /products
export const createProduct = async (req: Request, res: Response) => {
  try {
    const { product_name, sku, category, unit_price, current_stock, min_stock_alert, warehouse_location } = req.body;

    if (!product_name || !sku || unit_price === undefined) {
      return res.status(400).json({ error: 'product_name, sku and unit_price are required' });
    }
    if (unit_price < 0) {
      return res.status(400).json({ error: 'unit_price cannot be negative' });
    }

    const product = await Product.create({
      product_name, sku, category: category || null, unit_price,
      current_stock: current_stock || 0, min_stock_alert: min_stock_alert || 0,
      warehouse_location: warehouse_location || null,
    });

    return res.status(201).json({ data: toClient(product.toObject()) });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A product with this SKU already exists' });
    }
    console.error('createProduct error:', err);
    return res.status(500).json({ error: 'Failed to create product' });
  }
};

// PUT /products/:id  (does NOT change current_stock directly -- use stock movements for that)
export const updateProduct = async (req: Request, res: Response) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Product not found' });
    const allowed = ['product_name', 'category', 'unit_price', 'min_stock_alert', 'warehouse_location'];
    const set: any = {};
    for (const k of allowed) if (req.body[k] !== undefined) set[k] = req.body[k];

    const product = await Product.findByIdAndUpdate(req.params.id, { $set: set }, { new: true, runValidators: true }).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.status(200).json({ data: toClient(product) });
  } catch (err) {
    console.error('updateProduct error:', err);
    return res.status(500).json({ error: 'Failed to update product' });
  }
};

// POST /products/:id/stock-movements  -> adjust stock with an audit trail entry
// The stock check + decrement is one atomic update, so concurrent requests can't oversell.
export const addStockMovement = async (req: Request, res: Response) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Product not found' });
    const { quantity_changed, movement_type, reason } = req.body;
    const userId = req.user?.id;

    const qty = Number(quantity_changed);
    if (!qty || qty <= 0) {
      return res.status(400).json({ error: 'quantity_changed must be a positive number' });
    }
    if (!['IN', 'OUT'].includes(movement_type)) {
      return res.status(400).json({ error: 'movement_type must be IN or OUT' });
    }

    const delta = movement_type === 'IN' ? qty : -qty;
    // For OUT, only match when stock is sufficient — atomic guard, no oversell.
    const product = await Product.findOneAndUpdate(
      movement_type === 'IN'
        ? { _id: req.params.id }
        : { _id: req.params.id, current_stock: { $gte: qty } },
      { $inc: { current_stock: delta } },
      { new: true }
    ).lean();
    if (!product) {
      const exists = await Product.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ error: 'Product not found' });
      return res.status(400).json({ error: 'Insufficient stock for this OUT movement' });
    }

    const movement = await StockMovement.create({
      product_id: product._id, quantity_changed: qty, movement_type, reason: reason || null, created_by: userId || null,
    });

    return res.status(201).json({ data: toClient(movement.toObject()), new_stock: product.current_stock });
  } catch (err) {
    console.error('addStockMovement error:', err);
    return res.status(500).json({ error: 'Failed to record stock movement' });
  }
};

// GET /products/:id/stock-movements
export const getStockMovements = async (req: Request, res: Response) => {
  try {
    if (!isId(req.params.id)) return res.status(200).json({ data: [] });
    const movements = await StockMovement.find({ product_id: req.params.id }).sort({ created_at: -1 }).lean();
    const userIds = [...new Set(movements.map((m: any) => String(m.created_by)).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const names = new Map(users.map((u: any) => [String(u._id), u.name]));
    return res.status(200).json({
      data: movements.map((m: any) => ({ ...toClient(m), created_by_name: m.created_by ? names.get(String(m.created_by)) ?? null : null })),
    });
  } catch (err) {
    console.error('getStockMovements error:', err);
    return res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
};

// GET /products/movements/all?limit=50 — global recent stock history
export const getAllStockMovements = async (req: Request, res: Response) => {
  try {
    const limitNum = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const [movements, products, users] = await Promise.all([
      StockMovement.find().sort({ created_at: -1 }).limit(limitNum).lean(),
      Product.find({}, { product_name: 1, sku: 1 }).lean(),
      User.find({}, { name: 1 }).lean(),
    ]);
    const pMap = new Map(products.map((p: any) => [String(p._id), p]));
    const uMap = new Map(users.map((u: any) => [String(u._id), u.name]));
    return res.status(200).json({
      data: movements.map((m: any) => {
        const p = pMap.get(String(m.product_id));
        return {
          ...toClient(m),
          product_name: p?.product_name ?? null,
          sku: p?.sku ?? null,
          created_by_name: m.created_by ? uMap.get(String(m.created_by)) ?? null : null,
        };
      }),
    });
  } catch (err) {
    console.error('getAllStockMovements error:', err);
    return res.status(500).json({ error: 'Failed to fetch stock history' });
  }
};

// DELETE /products/:id
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Product not found' });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const usedInChallan = await Challan.exists({ 'items.product_id': product._id });
    const hasMovements = await StockMovement.exists({ product_id: product._id });
    if (usedInChallan || hasMovements) {
      return res.status(409).json({ error: 'Cannot delete: product is used in challans or stock movements.' });
    }

    await product.deleteOne();
    return res.status(200).json({ message: 'Product deleted' });
  } catch (err) {
    console.error('deleteProduct error:', err);
    return res.status(500).json({ error: 'Failed to delete product' });
  }
};
