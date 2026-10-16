import { Schema, model, models, Types } from 'mongoose';

const opts = { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } };

// Converts a lean() doc into the API shape the frontend already expects:
// string `id` instead of `_id`, no `__v`.
export const toClient = (doc: any) => {
  const { _id, __v, ...rest } = doc as any;
  return { id: String(_id), ...rest };
};

export const isId = (v: unknown) => Types.ObjectId.isValid(v as any);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    role: { type: String, required: true, enum: ['admin', 'sales', 'warehouse', 'accounts'] },
  },
  opts
);

export const User = models.User || model('User', userSchema);

const customerSchema = new Schema(
  {
    customer_name: { type: String, required: true, trim: true },
    mobile_number: { type: String, required: true, trim: true },
    email: { type: String, default: null },
    business_name: { type: String, default: null },
    gst_number: { type: String, default: null },
    customer_type: { type: String, required: true, enum: ['Retail', 'Wholesale', 'Distributor'] },
    address: { type: String, default: null },
    status: { type: String, default: 'Lead', enum: ['Lead', 'Active', 'Inactive'] },
    follow_up_date: { type: Date, default: null },
    notes: { type: String, default: null },
  },
  opts
);
customerSchema.index({ customer_name: 'text', business_name: 'text' });

export const Customer = models.Customer || model('Customer', customerSchema);

const productSchema = new Schema(
  {
    product_name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true },
    category: { type: String, default: null },
    unit_price: { type: Number, required: true, min: 0 },
    current_stock: { type: Number, default: 0 },
    min_stock_alert: { type: Number, default: 0 },
    warehouse_location: { type: String, default: null },
  },
  opts
);
productSchema.index({ product_name: 'text', sku: 'text' });

export const Product = models.Product || model('Product', productSchema);

const movementSchema = new Schema(
  {
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    quantity_changed: { type: Number, required: true },
    movement_type: { type: String, required: true, enum: ['IN', 'OUT'] },
    reason: { type: String, default: null },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

export const StockMovement = models.StockMovement || model('StockMovement', movementSchema);

const challanItemSchema = new Schema(
  {
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    product_name_snapshot: { type: String, required: true },
    unit_price_snapshot: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const challanSchema = new Schema(
  {
    challan_number: { type: String, required: true, unique: true },
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    total_quantity: { type: Number, default: 0 },
    status: { type: String, default: 'Draft', enum: ['Draft', 'Confirmed', 'Cancelled'] },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    items: { type: [challanItemSchema], default: [] },
  },
  opts
);

export const Challan = models.Challan || model('Challan', challanSchema);

// Atomic yearly sequence for challan numbers (CH-2026-000123).
// Counter-per-year avoids the COUNT(*) race in the old SQL version.
const counterSchema = new Schema({
  year: { type: Number, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

export const Counter = models.Counter || model('Counter', counterSchema);

export const nextChallanNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const c = await Counter.findOneAndUpdate({ year }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `CH-${year}-${String(c.seq).padStart(6, '0')}`;
};
