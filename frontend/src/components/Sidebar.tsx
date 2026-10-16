import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <button className="sidebar-toggle" onClick={() => setOpen(!open)} aria-label="Menu">
        ☰
      </button>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <h2>FundsRoom ERP</h2>
          <span className="role-badge">{user?.role}</span>
        </div>
        <nav onClick={() => setOpen(false)}>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/customers">Customers</NavLink>
          <NavLink to="/products">Products</NavLink>
          <NavLink to="/challans">Sales Challans</NavLink>
          <NavLink to="/stock">Stock History</NavLink>
          {user?.role === 'admin' && <NavLink to="/users">Users</NavLink>}
          <NavLink to="/account">Account</NavLink>
        </nav>
        <div className="sidebar-footer">
          <p>{user?.name}</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </aside>
    </>
  );
};
