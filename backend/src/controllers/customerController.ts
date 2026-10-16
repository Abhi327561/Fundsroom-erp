import { Request, Response } from 'express';
import { Customer, Challan, toClient, isId } from '../models/store';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pageParams = (req: Request, def = 10) => {
  const pageNum = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(req.query.limit as string) || def, 1), 100);
  return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
};

// GET /customers?search=&status=&page=&limit=
export const getCustomers = async (req: Request, res: Response) => {
  try {
    const { search = '', status } = req.query;
    const { pageNum, limitNum, skip } = pageParams(req);

    const filter: any = {};
    if (search) {
      const rx = new RegExp(escapeRegExp(String(search)), 'i');
      filter.$or = [{ customer_name: rx }, { mobile_number: rx }, { business_name: rx }];
    }
    if (status) filter.status = status;

    const [total, rows] = await Promise.all([
      Customer.countDocuments(filter),
      Customer.find(filter).sort({ created_at: -1 }).skip(skip).limit(limitNum).lean(),
    ]);

    return res.status(200).json({
      data: rows.map(toClient),
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('getCustomers error:', err);
    return res.status(500).json({ error: 'Failed to fetch customers' });
  }
};

// GET /customers/:id
export const getCustomerById = async (req: Request, res: Response) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Customer not found' });
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    return res.status(200).json({ data: toClient(customer) });
  } catch (err) {
    console.error('getCustomerById error:', err);
    return res.status(500).json({ error: 'Failed to fetch customer' });
  }
};

// POST /customers
export const createCustomer = async (req: Request, res: Response) => {
  try {
    const {
      customer_name, mobile_number, email, business_name,
      gst_number, customer_type, address, status, follow_up_date, notes,
    } = req.body;

    if (!customer_name || !mobile_number || !customer_type) {
      return res.status(400).json({ error: 'customer_name, mobile_number and customer_type are required' });
    }
    if (!['Retail', 'Wholesale', 'Distributor'].includes(customer_type)) {
      return res.status(400).json({ error: 'customer_type must be Retail, Wholesale or Distributor' });
    }

    const customer = await Customer.create({
      customer_name, mobile_number, email: email || null, business_name: business_name || null,
      gst_number: gst_number || null, customer_type, address: address || null,
      status: status || 'Lead', follow_up_date: follow_up_date || null, notes: notes || null,
    });

    return res.status(201).json({ data: toClient(customer.toObject()) });
  } catch (err) {
    console.error('createCustomer error:', err);
    return res.status(500).json({ error: 'Failed to create customer' });
  }
};

// PUT /customers/:id — only provided fields are updated
export const updateCustomer = async (req: Request, res: Response) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Customer not found' });
    const allowed = [
      'customer_name', 'mobile_number', 'email', 'business_name', 'gst_number',
      'customer_type', 'address', 'status', 'follow_up_date', 'notes',
    ];
    const set: any = {};
    for (const k of allowed) if (req.body[k] !== undefined) set[k] = req.body[k];

    const customer = await Customer.findByIdAndUpdate(req.params.id, { $set: set }, { new: true, runValidators: true }).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    return res.status(200).json({ data: toClient(customer) });
  } catch (err) {
    console.error('updateCustomer error:', err);
    return res.status(500).json({ error: 'Failed to update customer' });
  }
};

// POST /customers/:id/notes  -> quick follow-up note append
export const addFollowUpNote = async (req: Request, res: Response) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Customer not found' });
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'note is required' });

    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const timestamp = new Date().toISOString();
    customer.notes = customer.notes ? `${customer.notes}\n[${timestamp}] ${note}` : `[${timestamp}] ${note}`;
    await customer.save();

    return res.status(200).json({ data: toClient(customer.toObject()) });
  } catch (err) {
    console.error('addFollowUpNote error:', err);
    return res.status(500).json({ error: 'Failed to add follow-up note' });
  }
};

// DELETE /customers/:id
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Customer not found' });
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const hasChallans = await Challan.exists({ customer_id: customer._id });
    if (hasChallans) {
      return res.status(409).json({ error: 'Cannot delete: customer has challans. Set status to Inactive instead.' });
    }

    await customer.deleteOne();
    return res.status(200).json({ message: 'Customer deleted' });
  } catch (err) {
    console.error('deleteCustomer error:', err);
    return res.status(500).json({ error: 'Failed to delete customer' });
  }
};
