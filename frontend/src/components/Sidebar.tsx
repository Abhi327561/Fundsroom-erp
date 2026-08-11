import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Sidebar = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>FundsRoom ERP</h2>
        <span className="role-badge">{user?.role}</span>
      </div>
      <nav>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/customers">Customers</NavLink>
        <NavLink to="/products">Products</NavLink>
        <NavLink to="/challans">Sales Challans</NavLink>
      </nav>
      <div className="sidebar-footer">
        <p>{user?.name}</p>
        <button onClick={logout}>Logout</button>
      </div>
    </aside>
  );
};
