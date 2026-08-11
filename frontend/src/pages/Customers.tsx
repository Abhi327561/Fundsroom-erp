import { useEffect, useState } from 'react';
import api from '../api/client';
import { Sidebar } from '../components/Sidebar';

interface Customer {
  id: number;
  customer_name: string;
  mobile_number: string;
  business_name: string;
  customer_type: string;
  status: string;
}

export const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customer_name: '', mobile_number: '', email: '', business_name: '',
    customer_type: 'Retail', address: '',
  });

  const loadCustomers = async () => {
    const res = await api.get(`/customers?search=${search}`);
    setCustomers(res.data.data);
  };

  useEffect(() => { loadCustomers(); }, [search]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/customers', form);
    setShowForm(false);
    setForm({ customer_name: '', mobile_number: '', email: '', business_name: '', customer_type: 'Retail', address: '' });
    loadCustomers();
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <h1>Customers</h1>
          <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Customer'}</button>
        </div>

        <input
          className="search-bar"
          placeholder="Search by name, mobile, or business..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {showForm && (
          <form className="inline-form" onSubmit={handleAdd}>
            <input placeholder="Customer name" required value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            <input placeholder="Mobile number" required value={form.mobile_number}
              onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} />
            <input placeholder="Email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Business name" value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
            <select value={form.customer_type}
              onChange={(e) => setForm({ ...form, customer_type: e.target.value })}>
              <option>Retail</option>
              <option>Wholesale</option>
              <option>Distributor</option>
            </select>
            <input placeholder="Address" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <button type="submit">Save Customer</button>
          </form>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Mobile</th><th>Business</th><th>Type</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.customer_name}</td>
                <td>{c.mobile_number}</td>
                <td>{c.business_name}</td>
                <td>{c.customer_type}</td>
                <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
};
