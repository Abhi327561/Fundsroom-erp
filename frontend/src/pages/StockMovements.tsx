import { useEffect, useState } from 'react';
import api from '../api/client';
import { Sidebar } from '../components/Sidebar';
import { useToast } from '../components/Toast';
import { SkeletonTable } from '../components/Skeleton';

interface Movement {
  id: number;
  product_id: number;
  product_name: string | null;
  sku: string | null;
  quantity_changed: number;
  movement_type: 'IN' | 'OUT';
  reason: string | null;
  created_at: string;
  created_by_name: string | null;
}

export const StockMovements = () => {
  const { toast } = useToast();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/products/movements/all', { params: { limit: 100 } })
      .then((res) => setMovements(res.data.data))
      .catch(() => toast('Failed to load stock history', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <h1>Stock History</h1>
        </div>
        {loading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : movements.length === 0 ? (
          <div className="empty-state">
            <h3>No stock movements yet</h3>
            <p>Adjust stock from Products or confirm a challan.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Reason</th><th>By</th></tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.created_at).toLocaleString()}</td>
                  <td>{m.product_name || `#${m.product_id}`} {m.sku ? `(${m.sku})` : ''}</td>
                  <td><span className={`badge ${m.movement_type === 'IN' ? 'badge-active' : 'badge-cancelled'}`}>{m.movement_type}</span></td>
                  <td>{m.quantity_changed}</td>
                  <td>{m.reason || '—'}</td>
                  <td>{m.created_by_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
};
