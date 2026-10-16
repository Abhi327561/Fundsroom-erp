import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../api/client';
import { Sidebar } from '../components/Sidebar';
import { useToast } from '../components/Toast';
import { useCountUp } from '../hooks/useCountUp';
import { SkeletonStat, SkeletonBars, SkeletonPie, SkeletonTable } from '../components/Skeleton';

interface Analytics {
  stats: { customers: number; products: number; challans: number; draftChallans: number; lowStock: number; inventoryValue: number };
  challansByStatus: { name: string; value: number }[];
  customersByType: { name: string; value: number }[];
  stockByCategory: { name: string; stock: number; value: number }[];
  challansTrend: { day: string; challans: number; qty: number }[];
  movementsTrend: { day: string; stock_in: number; stock_out: number }[];
  lowStock: { id: string; product_name: string; sku: string; current_stock: number; min_stock_alert: number }[];
  recentChallans: { id: string; challan_number: string; customer_name: string; status: string; total_quantity: number; created_at: string }[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6'];
const STATUS_COLORS: Record<string, string> = { Draft: '#6366f1', Confirmed: '#10b981', Cancelled: '#f43f5e' };

const inr = (n: number) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const Dashboard = () => {
  const { toast } = useToast();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/dashboard');
      setData(res.data);
    } catch {
      toast('Failed to load dashboard analytics', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Hooks must run on every render — before any early return.
  const stats = data?.stats;
  const customers = useCountUp(stats?.customers ?? 0);
  const products = useCountUp(stats?.products ?? 0);
  const lowStockCount = useCountUp(stats?.lowStock ?? 0);
  const challans = useCountUp(stats?.challans ?? 0);

  if (loading || !data || !stats) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="content">
          <div className="page-header">
            <div><h1>Dashboard</h1><p className="page-sub">Operations overview</p></div>
          </div>
          <div className="stat-grid">
            {[0, 1, 2, 3].map((i) => <SkeletonStat key={i} />)}
          </div>
          <div className="chart-grid">
            <section className="card chart-card chart-span-2"><SkeletonBars /></section>
            <section className="card chart-card"><SkeletonPie /></section>
            <section className="card chart-card"><SkeletonBars /></section>
            <section className="card chart-card"><SkeletonPie /></section>
          </div>
          <div className="dash-grid">
            <section className="card dash-panel"><SkeletonTable rows={4} cols={3} /></section>
            <section className="card dash-panel"><SkeletonTable rows={4} cols={3} /></section>
          </div>
        </main>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <div>
            <h1>Dashboard</h1>
            <p className="page-sub">{today} • Here's what's happening across sales and inventory.</p>
          </div>
          <button className="btn-ghost" onClick={load}>↻ Refresh</button>
        </div>

        <div className="stat-grid">
          <Link to="/customers" className="stat-card stat-indigo">
            <span className="stat-icon">👥</span>
            <div><h3>{customers}</h3><p>Total Customers</p></div>
          </Link>
          <Link to="/products" className="stat-card stat-emerald">
            <span className="stat-icon">📦</span>
            <div><h3>{products}</h3><p>Total Products</p></div>
          </Link>
          <Link to="/products" className="stat-card stat-rose">
            <span className="stat-icon">⚠️</span>
            <div><h3>{lowStockCount}</h3><p>Low Stock Alerts</p></div>
          </Link>
          <div className="stat-card stat-amber">
            <span className="stat-icon">💰</span>
            <div><h3>{inr(stats.inventoryValue)}</h3><p>Inventory Value</p></div>
          </div>
        </div>

        <div className="chart-grid">
          <section className="card chart-card chart-span-2">
            <div className="card-head">
              <div><h2>Sales activity</h2><p className="muted">Challans created per day — last 14 days</p></div>
              <span className="pill">{challans} total • {stats.draftChallans} draft</span>
            </div>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.challansTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gChallan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={2} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="challans" name="Challans" stroke="#6366f1" strokeWidth={2.5} fill="url(#gChallan)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card chart-card">
            <div className="card-head"><div><h2>Challans by status</h2></div></div>
            {data.challansByStatus.length === 0 ? (
              <p className="muted">No challans yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={data.challansByStatus} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                    {data.challansByStatus.map((s) => (
                      <Cell key={s.name} fill={STATUS_COLORS[s.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </section>

          <section className="card chart-card">
            <div className="card-head"><div><h2>Stock movement</h2><p className="muted">IN vs OUT per day — last 14 days</p></div></div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.movementsTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="stock_in" name="Stock IN" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="stock_out" name="Stock OUT" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="card chart-card">
            <div className="card-head"><div><h2>Inventory value by category</h2></div></div>
            {data.stockByCategory.length === 0 ? (
              <p className="muted">No products yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.stockByCategory} layout="vertical" margin={{ top: 0, right: 24, left: 24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                  <Tooltip formatter={(v: any) => inr(Number(v))} />
                  <Bar dataKey="value" name="Value" radius={[0, 6, 6, 0]}>
                    {data.stockByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>

          <section className="card chart-card">
            <div className="card-head"><div><h2>Customers by type</h2></div></div>
            {data.customersByType.length === 0 ? (
              <p className="muted">No customers yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={data.customersByType} dataKey="value" nameKey="name" outerRadius={92} paddingAngle={3}>
                    {data.customersByType.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </section>
        </div>

        <div className="dash-grid">
          <section className="card dash-panel">
            <div className="card-head">
              <h2>Low stock — reorder soon</h2>
              <Link to="/products" className="link">View all →</Link>
            </div>
            {data.lowStock.length === 0 ? (
              <p className="muted">All stocked up. No alerts. 🎉</p>
            ) : (
              <table className="data-table">
                <thead><tr><th>Product</th><th>SKU</th><th>Stock</th></tr></thead>
                <tbody>
                  {data.lowStock.map((p) => (
                    <tr key={p.id}>
                      <td>{p.product_name}</td>
                      <td>{p.sku}</td>
                      <td><span className="stock-low">{p.current_stock} / {p.min_stock_alert}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card dash-panel">
            <div className="card-head">
              <h2>Recent challans</h2>
              <Link to="/challans" className="link">View all →</Link>
            </div>
            {data.recentChallans.length === 0 ? (
              <p className="muted">No challans yet.</p>
            ) : (
              <table className="data-table">
                <thead><tr><th>#</th><th>Customer</th><th>Status</th></tr></thead>
                <tbody>
                  {data.recentChallans.map((c) => (
                    <tr key={c.id}>
                      <td>{c.challan_number}</td>
                      <td>{c.customer_name}</td>
                      <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};


