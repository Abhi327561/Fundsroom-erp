import { Request, Response } from 'express';
import { pool } from '../config/db';

// GET /customers?search=&status=&page=&limit=
export const getCustomers = async (req: Request, res: Response) => {
  try {
    const { search = '', status, page = '1', limit = '10' } = req.query;
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const limitNum = Math.max(parseInt(limit as string) || 10, 1);
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const values: any[] = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(customer_name ILIKE $${values.length} OR mobile_number ILIKE $${values.length} OR business_name ILIKE $${values.length})`
      );
    }
    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM customers ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    values.push(limitNum, offset);
    const result = await pool.query(
      `SELECT * FROM customers ${whereClause} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return res.status(200).json({
      data: result.rows,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('getCustomers error:', err);
    return res.status(500).json({ error: 'Failed to fetch customers' });
  }
};

// GET /customers/:id  -> includes follow-up notes
export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    return res.status(200).json({ data: customerResult.rows[0] });
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

    const result = await pool.query(
      `INSERT INTO customers
        (customer_name, mobile_number, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [customer_name, mobile_number, email || null, business_name || null, gst_number || null,
       customer_type, address || null, status || 'Lead', follow_up_date || null, notes || null]
    );

    return res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error('createCustomer error:', err);
    return res.status(500).json({ error: 'Failed to create customer' });
  }
};

// PUT /customers/:id
export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      customer_name, mobile_number, email, business_name,
      gst_number, customer_type, address, status, follow_up_date, notes,
    } = req.body;

    const existing = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const result = await pool.query(
      `UPDATE customers SET
        customer_name = COALESCE($1, customer_name),
        mobile_number = COALESCE($2, mobile_number),
        email = COALESCE($3, email),
        business_name = COALESCE($4, business_name),
        gst_number = COALESCE($5, gst_number),
        customer_type = COALESCE($6, customer_type),
        address = COALESCE($7, address),
        status = COALESCE($8, status),
        follow_up_date = COALESCE($9, follow_up_date),
        notes = COALESCE($10, notes),
        updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [customer_name, mobile_number, email, business_name, gst_number,
       customer_type, address, status, follow_up_date, notes, id]
    );

    return res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    console.error('updateCustomer error:', err);
    return res.status(500).json({ error: 'Failed to update customer' });
  }
};

// POST /customers/:id/notes  -> quick follow-up note append
export const addFollowUpNote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({ error: 'note is required' });
    }

    const existing = await pool.query('SELECT notes FROM customers WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const timestamp = new Date().toISOString();
    const previousNotes = existing.rows[0].notes || '';
    const updatedNotes = previousNotes
      ? `${previousNotes}\n[${timestamp}] ${note}`
      : `[${timestamp}] ${note}`;

    const result = await pool.query(
      'UPDATE customers SET notes = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [updatedNotes, id]
    );

    return res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    console.error('addFollowUpNote error:', err);
    return res.status(500).json({ error: 'Failed to add follow-up note' });
  }
};
