import { useEffect, useState } from 'react';
import api from '../api/client';
import { Sidebar } from '../components/Sidebar';

interface Product {
  id: number;
  product_name: string;
  sku: string;
  category: string;
  unit_price: number;
  current_stock: number;
  min_stock_alert: number;
  warehouse_location: string;
}

export const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    product_name: '', sku: '', category: '', unit_price: '',
    current_stock: '', min_stock_alert: '', warehouse_location: '',
  });
  const [stockForm, setStockForm] = useState({ quantity_changed: '', movement_type: 'IN', reason: '' });
  const [error, setError] = useState('');

  const loadProducts = async () => {
    const res = await api.get(`/products?search=${search}&lowStock=${lowStockOnly}`);
    setProducts(res.data.data);
  };

  useEffect(() => { loadProducts(); }, [search, lowStockOnly]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/products', {
        ...form,
        unit_price: parseFloat(form.unit_price),
        current_stock: parseInt(form.current_stock) || 0,
        min_stock_alert: parseInt(form.min_stock_alert) || 0,
      });
      setShowForm(false);
      setForm({ product_name: '', sku: '', category: '', unit_price: '', current_stock: '', min_stock_alert: '', warehouse_location: '' });
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add product');
    }
  };

  const handleStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalProduct) return;
    setError('');
    try {
      await api.post(`/products/${stockModalProduct.id}/stock-movements`, {
        quantity_changed: parseInt(stockForm.quantity_changed),
        movement_type: stockForm.movement_type,
        reason: stockForm.reason,
      });
      setStockModalProduct(null);
      setStockForm({ quantity_changed: '', movement_type: 'IN', reason: '' });
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to adjust stock');
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <h1>Products & Inventory</h1>
          <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Product'}</button>
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

        {showForm && (
          <form className="inline-form" onSubmit={handleAdd}>
            <input placeholder="Product name" required value={form.product_name}
              onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
            <input placeholder="SKU" required value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <input placeholder="Category" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input placeholder="Unit price" type="number" step="0.01" required value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
            <input placeholder="Opening stock" type="number" value={form.current_stock}
              onChange={(e) => setForm({ ...form, current_stock: e.target.value })} />
            <input placeholder="Min stock alert" type="number" value={form.min_stock_alert}
              onChange={(e) => setForm({ ...form, min_stock_alert: e.target.value })} />
            <input placeholder="Warehouse location" value={form.warehouse_location}
              onChange={(e) => setForm({ ...form, warehouse_location: e.target.value })} />
            <button type="submit">Save Product</button>
            {error && <div className="error-message">{error}</div>}
          </form>
        )}

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
                <td>{p.category}</td>
                <td>₹{p.unit_price}</td>
                <td>
                  <span className={p.current_stock <= p.min_stock_alert ? 'stock-low' : ''}>
                    {p.current_stock}
                  </span>
                </td>
                <td>{p.warehouse_location}</td>
                <td>
                  <button className="btn-small" onClick={() => { setStockModalProduct(p); setError(''); }}>
                    Adjust Stock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {stockModalProduct && (
          <div className="modal-overlay" onClick={() => setStockModalProduct(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Adjust Stock — {stockModalProduct.product_name}</h3>
              <p>Current stock: {stockModalProduct.current_stock}</p>
              <form onSubmit={handleStockAdjust}>
                <select value={stockForm.movement_type}
                  onChange={(e) => setStockForm({ ...stockForm, movement_type: e.target.value })}>
                  <option value="IN">Stock IN</option>
                  <option value="OUT">Stock OUT</option>
                </select>
                <input type="number" placeholder="Quantity" required
                  value={stockForm.quantity_changed}
                  onChange={(e) => setStockForm({ ...stockForm, quantity_changed: e.target.value })} />
                <input placeholder="Reason (e.g. new delivery, damaged goods)"
                  value={stockForm.reason}
                  onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })} />
                {error && <div className="error-message">{error}</div>}
                <div className="modal-actions">
                  <button type="button" onClick={() => setStockModalProduct(null)}>Cancel</button>
                  <button type="submit">Confirm</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
