import { useEffect, useState } from 'react';
import api from '../api/client';
import { Sidebar } from '../components/Sidebar';

export const Dashboard = () => {
  const [stats, setStats] = useState({ customers: 0, products: 0, lowStock: 0, challans: 0 });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [customersRes, productsRes, lowStockRes, challansRes] = await Promise.all([
          api.get('/customers?limit=1'),
          api.get('/products?limit=1'),
          api.get('/products?lowStock=true&limit=1'),
          api.get('/challans?limit=1'),
        ]);
        setStats({
          customers: customersRes.data.pagination.total,
          products: productsRes.data.pagination.total,
          lowStock: lowStockRes.data.pagination.total,
          challans: challansRes.data.pagination.total,
        });
      } catch (err) {
        console.error('Failed to load dashboard stats', err);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <h1>Dashboard</h1>
        <div className="stat-grid">
          <div className="stat-card">
            <h3>{stats.customers}</h3>
            <p>Total Customers</p>
          </div>
          <div className="stat-card">
            <h3>{stats.products}</h3>
            <p>Total Products</p>
          </div>
          <div className="stat-card warning">
            <h3>{stats.lowStock}</h3>
            <p>Low Stock Alerts</p>
          </div>
          <div className="stat-card">
            <h3>{stats.challans}</h3>
            <p>Total Challans</p>
          </div>
        </div>
      </main>
    </div>
  );
};
