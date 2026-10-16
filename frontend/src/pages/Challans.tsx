import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import { Sidebar } from '../components/Sidebar';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { SkeletonTable } from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';

interface Customer { id: string; customer_name: string; }
interface Product { id: string; product_name: string; current_stock: number; unit_price: number; }
interface ChallanItem { product_id: string; quantity: number; }
interface Challan {
  id: string;
  challan_number: string;
  customer_name: string;
  total_quantity: number;
  status: 'Draft' | 'Confirmed' | 'Cancelled';
  created_at: string;
}
interface ChallanDetail extends Challan {
  customer_id: string;
  items: { product_id: string; product_name_snapshot: string; unit_price_snapshot: number; quantity: number }[];
}

export const Challans = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const canWrite = user?.role === 'admin' || user?.role === 'sales';

  const [challans, setChallans] = useState<Challan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState<ChallanItem[]>([{ product_id: '', quantity: 1 }]);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<ChallanDetail | null>(null);

  const loadChallans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/challans', {
        params: { status: statusFilter || undefined, page, limit: 10 },
      });
      setChallans(res.data.data);
      setTotalPages(res.data.pagination.totalPages || 1);
      setTotal(res.data.pagination.total || 0);
    } catch {
      toast('Failed to load challans', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, toast]);

  useEffect(() => { loadChallans(); }, [loadChallans]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  useEffect(() => {
    if (showForm) {
      api.get('/customers', { params: { limit: 100 } }).then((res) => setCustomers(res.data.data));
      api.get('/products', { params: { limit: 100 } }).then((res) => setProducts(res.data.data));
    }
  }, [showForm]);

  const addItemRow = () => setItems([...items, { product_id: '', quantity: 1 }]);
  const removeItemRow = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof ChallanItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value } as ChallanItem;
    setItems(updated);
  };

  // status: 'Draft' saves without touching stock, 'Confirmed' saves AND deducts stock immediately
  const handleCreate = async (status: 'Draft' | 'Confirmed') => {
    const validItems = items.filter((i) => i.product_id !== '' && i.quantity > 0);
    if (!customerId || validItems.length === 0) {
      toast('Select a customer and at least one product with quantity', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/challans', { customer_id: customerId, status, items: validItems });
      toast(status === 'Draft' ? 'Draft challan created' : 'Challan confirmed — stock deducted');
      setShowForm(false);
      setCustomerId('');
      setItems([{ product_id: '', quantity: 1 }]);
      loadChallans();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to create challan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await api.patch(`/challans/${id}/confirm`);
      toast('Challan confirmed — stock deducted');
      if (detail?.id === id) openDetail(id);
      loadChallans();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to confirm challan', 'error');
    }
  };

  const handleCancel = async (c: Challan) => {
    const msg = c.status === 'Confirmed'
      ? `Cancel ${c.challan_number}? Stock will be returned to inventory.`
      : `Cancel ${c.challan_number}?`;
    if (!window.confirm(msg)) return;
    try {
      const res = await api.patch(`/challans/${c.id}/cancel`);
      toast(res.data.restocked ? 'Cancelled — stock restocked' : 'Challan cancelled');
      if (detail?.id === c.id) setDetail(null);
      loadChallans();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to cancel challan', 'error');
    }
  };

  const openDetail = async (id: string) => {
    try {
      const res = await api.get(`/challans/${id}`);
      setDetail(res.data.data);
    } catch {
      toast('Failed to load challan detail', 'error');
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <h1>Sales Challans</h1>
          {canWrite && <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Challan'}</button>}
        </div>

        <div className="toolbar">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {showForm && (
          <div className="challan-builder">
            <h3>New Challan</h3>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">Select customer...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
            </select>

            {items.map((item, index) => (
              <div className="item-row" key={index}>
                <select value={item.product_id} onChange={(e) => updateItem(index, 'product_id', e.target.value)}>
                  <option value="">Select product...</option>
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
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                />
                {items.length > 1 && (
                  <button type="button" className="btn-small" onClick={() => removeItemRow(index)}>Remove</button>
                )}
              </div>
            ))}
            <button type="button" className="btn-small" onClick={addItemRow}>+ Add another product</button>

            <div className="modal-actions">
              <button type="button" disabled={saving} onClick={() => handleCreate('Draft')}>Save as Draft</button>
              <button type="button" className="btn-primary" disabled={saving} onClick={() => handleCreate('Confirmed')}>
                {saving ? 'Saving…' : 'Save & Confirm (deducts stock now)'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : challans.length === 0 ? (
          <div className="empty-state">
            <h3>No challans found</h3>
            <p>Create your first sales challan to get started.</p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Challan #</th><th>Customer</th><th>Total Qty</th><th>Status</th><th>Date</th><th></th>
                </tr>
              </thead>
              <tbody>
                {challans.map((c) => (
                  <tr key={c.id}>
                    <td><button className="link" onClick={() => openDetail(c.id)}>{c.challan_number}</button></td>
                    <td>{c.customer_name}</td>
                    <td>{c.total_quantity}</td>
                    <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="row-actions">
                      {c.status === 'Draft' && canWrite && (
                        <>
                          <button className="btn-small" onClick={() => handleConfirm(c.id)}>Confirm</button>
                          <button className="btn-small" onClick={() => handleCancel(c)}>Cancel</button>
                        </>
                      )}
                      {c.status === 'Confirmed' && canWrite && (
                        <button className="btn-small" onClick={() => handleCancel(c)}>Cancel + Restock</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
          </>
        )}

        {detail && (
          <Modal title={`Challan ${detail.challan_number}`} onClose={() => setDetail(null)} wide>
            <p className="muted">
              {detail.customer_name} • {detail.total_quantity} items •{' '}
              <span className={`badge badge-${detail.status.toLowerCase()}`}>{detail.status}</span>
            </p>
            <table className="data-table">
              <thead><tr><th>Product</th><th>Unit price</th><th>Qty</th><th>Line total</th></tr></thead>
              <tbody>
                {detail.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.product_name_snapshot}</td>
                    <td>₹{it.unit_price_snapshot}</td>
                    <td>{it.quantity}</td>
                    <td>₹{(Number(it.unit_price_snapshot) * it.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.status === 'Draft' && canWrite && (
              <div className="modal-actions">
                <button type="button" onClick={() => handleConfirm(detail.id)}>Confirm now</button>
              </div>
            )}
          </Modal>
        )}
      </main>
    </div>
  );
};
