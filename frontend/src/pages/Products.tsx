import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import { Sidebar } from '../components/Sidebar';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { SkeletonTable } from '../components/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';

interface Product {
  id: number;
  product_name: string;
  sku: string;
  category: string | null;
  unit_price: number;
  current_stock: number;
  min_stock_alert: number;
  warehouse_location: string | null;
}

interface Movement {
  id: number;
  quantity_changed: number;
  movement_type: 'IN' | 'OUT';
  reason: string | null;
  created_at: string;
  created_by_name: string | null;
}

const emptyForm = {
  product_name: '', sku: '', category: '', unit_price: '',
  min_stock_alert: '', warehouse_location: '',
};

export const Products = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const canWrite = user?.role === 'admin' || user?.role === 'warehouse';
  const canDelete = user?.role === 'admin';

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockForm, setStockForm] = useState({ quantity_changed: '', movement_type: 'IN', reason: '' });
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<Movement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const debouncedSearch = useDebounce(search);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/products', {
        params: { search: debouncedSearch, lowStock: lowStockOnly ? 'true' : undefined, page, limit: 10 },
      });
      setProducts(res.data.data);
      setTotalPages(res.data.pagination.totalPages || 1);
      setTotal(res.data.pagination.total || 0);
    } catch {
      toast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, lowStockOnly, page, toast]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { setPage(1); }, [debouncedSearch, lowStockOnly]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      product_name: p.product_name,
      sku: p.sku,
      category: p.category || '',
      unit_price: String(p.unit_price),
      min_stock_alert: String(p.min_stock_alert),
      warehouse_location: p.warehouse_location || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        product_name: form.product_name,
        sku: form.sku,
        category: form.category || null,
        unit_price: parseFloat(form.unit_price),
        min_stock_alert: parseInt(form.min_stock_alert) || 0,
        warehouse_location: form.warehouse_location || null,
        ...(editing ? {} : { current_stock: 0 }),
      };
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        toast('Product updated');
      } else {
        await api.post('/products', { ...payload, current_stock: 0 });
        toast('Product added — use Adjust Stock for opening stock');
      }
      setShowForm(false);
      loadProducts();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!window.confirm(`Delete ${p.product_name} (${p.sku})?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast('Product deleted');
      loadProducts();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to delete product', 'error');
    }
  };

  const handleStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct) return;
    try {
      await api.post(`/products/${stockProduct.id}/stock-movements`, {
        quantity_changed: parseInt(stockForm.quantity_changed),
        movement_type: stockForm.movement_type,
        reason: stockForm.reason || null,
      });
      toast('Stock updated');
      setStockProduct(null);
      setStockForm({ quantity_changed: '', movement_type: 'IN', reason: '' });
      loadProducts();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to adjust stock', 'error');
    }
  };

  const openHistory = async (p: Product) => {
    setHistoryProduct(p);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/products/${p.id}/stock-movements`);
      setHistory(res.data.data);
    } catch {
      toast('Failed to load stock history', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <h1>Products & Inventory</h1>
          {canWrite && <button onClick={openAdd}>+ Add Product</button>}
        </div>

        <div className="toolbar">
          <input
            className="search-bar"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="checkbox-label">
            <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
            Low stock only
          </label>
        </div>

        {loading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : products.length === 0 ? (
          <div className="empty-state">
            <h3>No products found</h3>
            <p>Try a different search or add a new product.</p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th><th>SKU</th><th>Category</th><th>Price</th>
                  <th>Stock</th><th>Location</th><th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.product_name}</td>
                    <td>{p.sku}</td>
                    <td>{p.category || '—'}</td>
                    <td>₹{p.unit_price}</td>
                    <td>
                      <span className={p.current_stock <= p.min_stock_alert ? 'stock-low' : ''}>
                        {p.current_stock}
                      </span>
                    </td>
                    <td>{p.warehouse_location || '—'}</td>
                    <td className="row-actions">
                      <button className="btn-small" onClick={() => openHistory(p)}>History</button>
                      {canWrite && (
                        <>
                          <button className="btn-small" onClick={() => { setStockProduct(p); }}>
                            Adjust Stock
                          </button>
                          <button className="btn-small" onClick={() => openEdit(p)}>Edit</button>
                          {canDelete && <button className="btn-small btn-danger" onClick={() => handleDelete(p)}>Delete</button>}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
          </>
        )}

        {showForm && (
          <Modal title={editing ? `Edit ${editing.product_name}` : 'Add Product'} onClose={() => setShowForm(false)}>
            <form className="form-grid" onSubmit={handleSave}>
              <input placeholder="Product name *" required value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
              <input placeholder="SKU *" required value={form.sku} disabled={!!editing}
                onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              <input placeholder="Category" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <input placeholder="Unit price *" type="number" step="0.01" min="0" required value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
              <input placeholder="Min stock alert" type="number" min="0" value={form.min_stock_alert}
                onChange={(e) => setForm({ ...form, min_stock_alert: e.target.value })} />
              <input placeholder="Warehouse location" value={form.warehouse_location}
                onChange={(e) => setForm({ ...form, warehouse_location: e.target.value })} />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </Modal>
        )}

        {stockProduct && (
          <Modal title={`Adjust Stock — ${stockProduct.product_name}`} onClose={() => setStockProduct(null)}>
            <p className="muted">Current stock: {stockProduct.current_stock}</p>
            <form className="form-grid" onSubmit={handleStockAdjust}>
              <select value={stockForm.movement_type}
                onChange={(e) => setStockForm({ ...stockForm, movement_type: e.target.value })}>
                <option value="IN">Stock IN</option>
                <option value="OUT">Stock OUT</option>
              </select>
              <input type="number" placeholder="Quantity *" min="1" required
                value={stockForm.quantity_changed}
                onChange={(e) => setStockForm({ ...stockForm, quantity_changed: e.target.value })} />
              <input placeholder="Reason (e.g. new delivery, damaged goods)"
                value={stockForm.reason}
                onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })} />
              <div className="modal-actions">
                <button type="button" onClick={() => setStockProduct(null)}>Cancel</button>
                <button type="submit">Confirm</button>
              </div>
            </form>
          </Modal>
        )}

        {historyProduct && (
          <Modal title={`Stock history — ${historyProduct.product_name}`} onClose={() => setHistoryProduct(null)} wide>
            {historyLoading ? (
              <div className="loading">Loading history…</div>
            ) : history.length === 0 ? (
              <div className="empty-state"><p>No stock movements yet.</p></div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Reason</th><th>By</th></tr></thead>
                <tbody>
                  {history.map((m) => (
                    <tr key={m.id}>
                      <td>{new Date(m.created_at).toLocaleString()}</td>
                      <td><span className={`badge ${m.movement_type === 'IN' ? 'badge-active' : 'badge-cancelled'}`}>{m.movement_type}</span></td>
                      <td>{m.quantity_changed}</td>
                      <td>{m.reason || '—'}</td>
                      <td>{m.created_by_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Modal>
        )}
      </main>
    </div>
  );
};
