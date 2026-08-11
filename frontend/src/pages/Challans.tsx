import { useEffect, useState } from 'react';
import api from '../api/client';
import { Sidebar } from '../components/Sidebar';

interface Customer { id: number; customer_name: string; }
interface Product { id: number; product_name: string; current_stock: number; unit_price: number; }
interface ChallanItem { product_id: number; quantity: number; }
interface Challan {
  id: number;
  challan_number: string;
  customer_name: string;
  total_quantity: number;
  status: 'Draft' | 'Confirmed' | 'Cancelled';
  created_at: string;
}

export const Challans = () => {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState<ChallanItem[]>([{ product_id: 0, quantity: 1 }]);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadChallans = async () => {
    const res = await api.get(`/challans${statusFilter ? `?status=${statusFilter}` : ''}`);
    setChallans(res.data.data);
  };

  useEffect(() => { loadChallans(); }, [statusFilter]);

  useEffect(() => {
    if (showForm) {
      api.get('/customers?limit=100').then((res) => setCustomers(res.data.data));
      api.get('/products?limit=100').then((res) => setProducts(res.data.data));
    }
  }, [showForm]);

  const addItemRow = () => setItems([...items, { product_id: 0, quantity: 1 }]);
  const removeItemRow = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof ChallanItem, value: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // status: 'Draft' saves without touching stock, 'Confirmed' saves AND deducts stock immediately
  const handleCreate = async (status: 'Draft' | 'Confirmed') => {
    setError('');
    const validItems = items.filter((i) => i.product_id > 0 && i.quantity > 0);
    if (!customerId || validItems.length === 0) {
      setError('Select a customer and at least one product with quantity');
      return;
    }
    try {
      await api.post('/challans', { customer_id: parseInt(customerId), status, items: validItems });
      setShowForm(false);
      setCustomerId('');
      setItems([{ product_id: 0, quantity: 1 }]);
      loadChallans();
    } catch (err: any) {
      // This is the key error surfaced by the backend's stock validation --
      // e.g. "Insufficient stock for PVC Pipe 2inch. Available: 15, requested: 20"
      setError(err.response?.data?.error || 'Failed to create challan');
    }
  };

  const handleConfirm = async (id: number) => {
    setError('');
    try {
      await api.patch(`/challans/${id}/confirm`);
      loadChallans();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to confirm challan');
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await api.patch(`/challans/${id}/cancel`);
      loadChallans();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel challan');
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <h1>Sales Challans</h1>
          <button onClick={() => { setShowForm(!showForm); setError(''); }}>
            {showForm ? 'Cancel' : '+ New Challan'}
          </button>
        </div>

        <div className="toolbar">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {error && <div className="error-message">{error}</div>}

        {showForm && (
          <div className="challan-builder">
            <h3>New Challan</h3>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">Select customer...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
            </select>

            {items.map((item, index) => (
              <div className="item-row" key={index}>
                <select value={item.product_id} onChange={(e) => updateItem(index, 'product_id', parseInt(e.target.value))}>
                  <option value={0}>Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.product_name} (stock: {p.current_stock}, ₹{p.unit_price})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                />
                {items.length > 1 && (
                  <button type="button" className="btn-small" onClick={() => removeItemRow(index)}>Remove</button>
                )}
              </div>
            ))}
            <button type="button" className="btn-small" onClick={addItemRow}>+ Add another product</button>

            <div className="modal-actions">
              <button type="button" onClick={() => handleCreate('Draft')}>Save as Draft</button>
              <button type="button" className="btn-primary" onClick={() => handleCreate('Confirmed')}>
                Save & Confirm (deducts stock now)
              </button>
            </div>
          </div>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <th>Challan #</th><th>Customer</th><th>Total Qty</th><th>Status</th><th>Date</th><th></th>
            </tr>
          </thead>
          <tbody>
            {challans.map((c) => (
              <tr key={c.id}>
                <td>{c.challan_number}</td>
                <td>{c.customer_name}</td>
                <td>{c.total_quantity}</td>
                <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                  {c.status === 'Draft' && (
                    <>
                      <button className="btn-small" onClick={() => handleConfirm(c.id)}>Confirm</button>
                      <button className="btn-small" onClick={() => handleCancel(c.id)}>Cancel</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
};
