import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import { Sidebar } from '../components/Sidebar';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { SkeletonTable } from '../components/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';

interface Customer {
  id: string;
  customer_name: string;
  mobile_number: string;
  email: string | null;
  business_name: string | null;
  customer_type: string;
  status: string;
  address: string | null;
  follow_up_date: string | null;
  notes: string | null;
}

const emptyForm = {
  customer_name: '', mobile_number: '', email: '', business_name: '',
  customer_type: 'Retail', status: 'Lead', address: '', follow_up_date: '',
};

export const Customers = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const canWrite = user?.role === 'admin' || user?.role === 'sales';
  const canDelete = user?.role === 'admin';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebounce(search);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers', {
        params: { search: debouncedSearch, status: status || undefined, page, limit: 10 },
      });
      setCustomers(res.data.data);
      setTotalPages(res.data.pagination.totalPages || 1);
      setTotal(res.data.pagination.total || 0);
    } catch {
      toast('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, page, toast]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { setPage(1); }, [debouncedSearch, status]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      customer_name: c.customer_name,
      mobile_number: c.mobile_number,
      email: c.email || '',
      business_name: c.business_name || '',
      customer_type: c.customer_type,
      status: c.status,
      address: c.address || '',
      follow_up_date: c.follow_up_date ? c.follow_up_date.slice(0, 10) : '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        email: form.email || null,
        business_name: form.business_name || null,
        address: form.address || null,
        follow_up_date: form.follow_up_date || null,
      };
      if (editing) {
        await api.put(`/customers/${editing.id}`, payload);
        toast('Customer updated');
      } else {
        await api.post('/customers', payload);
        toast('Customer added');
      }
      setShowForm(false);
      loadCustomers();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to save customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!window.confirm(`Delete ${c.customer_name}? Use Inactive instead if they have challans.`)) return;
    try {
      await api.delete(`/customers/${c.id}`);
      toast('Customer deleted');
      loadCustomers();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to delete customer', 'error');
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <h1>Customers</h1>
          {canWrite && <button onClick={openAdd}>+ Add Customer</button>}
        </div>

        <div className="toolbar">
          <input
            className="search-bar"
            placeholder="Search by name, mobile, or business..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Lead">Lead</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {loading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <h3>No customers found</h3>
            <p>Try a different search or add a new customer.</p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th><th>Mobile</th><th>Business</th><th>Type</th><th>Status</th>
                  {canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.customer_name}</td>
                    <td>{c.mobile_number}</td>
                    <td>{c.business_name || '—'}</td>
                    <td>{c.customer_type}</td>
                    <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
                    {canWrite && (
                      <td className="row-actions">
                        <button className="btn-small" onClick={() => openEdit(c)}>Edit</button>
                        {canDelete && <button className="btn-small btn-danger" onClick={() => handleDelete(c)}>Delete</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
          </>
        )}

        {showForm && (
          <Modal title={editing ? `Edit ${editing.customer_name}` : 'Add Customer'} onClose={() => setShowForm(false)}>
            <form className="form-grid" onSubmit={handleSave}>
              <input placeholder="Customer name *" required value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              <input placeholder="Mobile number *" required value={form.mobile_number}
                onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} />
              <input placeholder="Email" type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input placeholder="Business name" value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
              <select value={form.customer_type}
                onChange={(e) => setForm({ ...form, customer_type: e.target.value })}>
                <option>Retail</option>
                <option>Wholesale</option>
                <option>Distributor</option>
              </select>
              <select value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Lead</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
              <input placeholder="Address" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <input type="date" value={form.follow_up_date}
                onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </Modal>
        )}
      </main>
    </div>
  );
};
