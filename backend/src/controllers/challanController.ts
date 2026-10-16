import { Request, Response } from 'express';
import { Challan, Customer, Product, StockMovement, User, toClient, isId, nextChallanNumber } from '../models/store';

const pageParams = (req: Request, def = 10) => {
  const pageNum = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(req.query.limit as string) || def, 1), 100);
  return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
};

const withNames = async (challans: any[]) => {
  const custIds = [...new Set(challans.map((c) => String(c.customer_id)))];
  const userIds = [...new Set(challans.map((c) => String(c.created_by)).filter((v) => v && v !== 'null' && v !== 'undefined'))];
  const [customers, users] = await Promise.all([
    Customer.find({ _id: { $in: custIds } }).lean(),
    userIds.length ? User.find({ _id: { $in: userIds } }).lean() : [],
  ]);
  const cMap = new Map(customers.map((c: any) => [String(c._id), c]));
  const uMap = new Map(users.map((u: any) => [String(u._id), u.name]));
  return challans.map((c: any) => {
    const cust: any = cMap.get(String(c.customer_id));
    return {
      ...toClient(c),
      customer_name: cust?.customer_name ?? null,
      mobile_number: cust?.mobile_number ?? null,
      created_by_name: c.created_by ? uMap.get(String(c.created_by)) ?? null : null,
    };
  });
};

// GET /challans?status=&customer_id=&page=&limit=
export const getChallans = async (req: Request, res: Response) => {
  try {
    const { status, customer_id } = req.query;
    const { pageNum, limitNum, skip } = pageParams(req);

    const filter: any = {};
    if (status) filter.status = status;
    if (customer_id) {
      if (!isId(customer_id)) return res.status(200).json({ data: [], pagination: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 } });
      filter.customer_id = customer_id;
    }

    const [total, rows] = await Promise.all([
      Challan.countDocuments(filter),
      Challan.find(filter).sort({ created_at: -1 }).skip(skip).limit(limitNum).lean(),
    ]);

    return res.status(200).json({
      data: await withNames(rows),
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
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Challan not found' });
    const challan = await Challan.findById(req.params.id).lean();
    if (!challan) return res.status(404).json({ error: 'Challan not found' });
    const [named] = await withNames([challan]);
    return res.status(200).json({ data: named });
  } catch (err) {
    console.error('getChallanById error:', err);
    return res.status(500).json({ error: 'Failed to fetch challan' });
  }
};

// Deducts stock atomically per item; on any failure, already-deducted items are restored.
const deductStock = async (items: { productId: string; qty: number }[], challanNumber: string, userId?: string) => {
  const done: { productId: string; qty: number }[] = [];
  for (const { productId, qty } of items) {
    const p = await Product.findOneAndUpdate(
      { _id: productId, current_stock: { $gte: qty } },
      { $inc: { current_stock: -qty } },
      { new: true }
    ).lean();
    if (!p) {
      for (const d of done) {
        await Product.updateOne({ _id: d.productId }, { $inc: { current_stock: d.qty } });
      }
      const current = await Product.findById(productId).lean();
      return { ok: false as const, product: current, qty };
    }
    done.push({ productId, qty });
    await StockMovement.create({
      product_id: productId, quantity_changed: qty, movement_type: 'OUT',
      reason: `Sales Challan ${challanNumber}`, created_by: userId || null,
    });
  }
  return { ok: true as const };
};

// POST /challans  -> create as Draft (no stock impact) or Confirmed (deducts stock)
export const createChallan = async (req: Request, res: Response) => {
  try {
    const { customer_id, status = 'Draft', items } = req.body;
    const userId = req.user?.id;

    if (!customer_id || !isId(customer_id) || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'customer_id and at least one item are required' });
    }
    if (!['Draft', 'Confirmed'].includes(status)) {
      return res.status(400).json({ error: 'status must be Draft or Confirmed' });
    }

    const customer = await Customer.findById(customer_id).lean();
    if (!customer) return res.status(400).json({ error: 'Customer does not exist' });

    // Validate every line: product exists, quantity positive
    let totalQuantity = 0;
    const lines: { productId: string; qty: number; name: string; price: number }[] = [];
    for (const item of items) {
      if (!isId(item.product_id)) return res.status(400).json({ error: `Product ID ${item.product_id} does not exist` });
      const product: any = await Product.findById(item.product_id).lean();
      if (!product) return res.status(400).json({ error: `Product ID ${item.product_id} does not exist` });
      const qty = Number(item.quantity);
      if (!qty || qty <= 0) return res.status(400).json({ error: `Invalid quantity for product ${product.product_name}` });
      if (status === 'Confirmed' && qty > product.current_stock) {
        return res.status(400).json({
          error: `Insufficient stock for "${product.product_name}". Available: ${product.current_stock}, requested: ${qty}`,
        });
      }
      lines.push({ productId: String(product._id), qty, name: product.product_name, price: product.unit_price });
      totalQuantity += qty;
    }

    const challanNumber = await nextChallanNumber();
    const challan = await Challan.create({
      challan_number: challanNumber,
      customer_id,
      total_quantity: totalQuantity,
      status,
      created_by: userId || null,
      items: lines.map((l) => ({
        product_id: l.productId, product_name_snapshot: l.name, unit_price_snapshot: l.price, quantity: l.qty,
      })),
    });

    if (status === 'Confirmed') {
      const res2 = await deductStock(lines.map((l) => ({ productId: l.productId, qty: l.qty })), challanNumber, userId);
      if (!res2.ok) {
        // Stock changed between validation and deduction — roll back the challan too.
        await Challan.deleteOne({ _id: challan._id });
        return res.status(400).json({
          error: `Insufficient stock for "${res2.product?.product_name}". Available: ${res2.product?.current_stock ?? 0}, requested: ${res2.qty}`,
        });
      }
    }

    return res.status(201).json({ data: toClient(challan.toObject()) });
  } catch (err: any) {
    if (err.code === 11000) return res.status(409).json({ error: 'Challan number collision, please retry' });
    console.error('createChallan error:', err);
    return res.status(500).json({ error: 'Failed to create challan' });
  }
};

// PATCH /challans/:id/confirm  -> Draft to Confirmed, deduct stock
export const confirmChallan = async (req: Request, res: Response) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Challan not found' });
    const userId = req.user?.id;
    const challan: any = await Challan.findById(req.params.id);
    if (!challan) return res.status(404).json({ error: 'Challan not found' });
    if (challan.status !== 'Draft') {
      return res.status(400).json({ error: `Only Draft challans can be confirmed. Current status: ${challan.status}` });
    }

    const res2 = await deductStock(
      challan.items.map((i: any) => ({ productId: String(i.product_id), qty: i.quantity })),
      challan.challan_number,
      userId
    );
    if (!res2.ok) {
      return res.status(400).json({
        error: `Insufficient stock for "${res2.product?.product_name}". Available: ${res2.product?.current_stock ?? 0}, requested: ${res2.qty}`,
      });
    }

    // Atomic status flip — a concurrent confirm/cancel wins or loses here, never both.
    const updated = await Challan.findOneAndUpdate(
      { _id: challan._id, status: 'Draft' }, { $set: { status: 'Confirmed' } }, { new: true }
    ).lean();
    if (!updated) return res.status(400).json({ error: 'Challan is no longer a Draft' });
    return res.status(200).json({ data: toClient(updated) });
  } catch (err) {
    console.error('confirmChallan error:', err);
    return res.status(500).json({ error: 'Failed to confirm challan' });
  }
};

// PATCH /challans/:id/cancel — restocks if it was Confirmed
export const cancelChallan = async (req: Request, res: Response) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Challan not found' });
    const userId = req.user?.id;

    const challan: any = await Challan.findById(req.params.id).lean();
    if (!challan) return res.status(404).json({ error: 'Challan not found' });
    if (challan.status === 'Cancelled') return res.status(400).json({ error: 'Challan is already cancelled' });
    const wasConfirmed = challan.status === 'Confirmed';

    // Atomic flip guarded on the observed status — a concurrent confirm/cancel
    // changes the status first and makes this update match nothing.
    const updated: any = await Challan.findOneAndUpdate(
      { _id: challan._id, status: challan.status },
      { $set: { status: 'Cancelled' } },
      { new: true }
    ).lean();
    if (!updated) return res.status(400).json({ error: 'Challan status changed, please refresh' });

    let restocked = false;
    if (wasConfirmed) {
      for (const item of updated.items) {
        await Product.updateOne({ _id: item.product_id }, { $inc: { current_stock: item.quantity } });
        await StockMovement.create({
          product_id: item.product_id, quantity_changed: item.quantity, movement_type: 'IN',
          reason: `Challan ${updated.challan_number} cancelled (restock)`, created_by: userId || null,
        });
      }
      restocked = true;
    }

    return res.status(200).json({ data: toClient(updated), restocked });
  } catch (err) {
    console.error('cancelChallan error:', err);
    return res.status(500).json({ error: 'Failed to cancel challan' });
  }
};
