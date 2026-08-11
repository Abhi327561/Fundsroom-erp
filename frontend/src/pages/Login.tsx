import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Convenience for demoing all 4 roles quickly during your recording
  const quickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>FundsRoom ERP</h1>
        <p>Sign in to continue</p>

        {error && <div className="error-message">{error}</div>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="demo-logins">
          <p>Quick demo login (password: password123)</p>
          <button type="button" onClick={() => quickLogin('admin@fundsroom.com')}>Admin</button>
          <button type="button" onClick={() => quickLogin('sales@fundsroom.com')}>Sales</button>
          <button type="button" onClick={() => quickLogin('warehouse@fundsroom.com')}>Warehouse</button>
          <button type="button" onClick={() => quickLogin('accounts@fundsroom.com')}>Accounts</button>
        </div>
      </form>
    </div>
  );
};
