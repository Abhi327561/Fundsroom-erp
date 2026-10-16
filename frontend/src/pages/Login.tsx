import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const isDev = import.meta.env.DEV;

const PERKS = [
  { icon: '📦', title: 'Live inventory', desc: 'Stock levels, alerts & full movement history.' },
  { icon: '🧾', title: 'Sales challans', desc: 'Draft → Confirm with auto stock deduction.' },
  { icon: '📊', title: 'Analytics', desc: 'Trends, categories & low-stock insights.' },
];

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
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
      const status = err.response?.status;
      setError(
        !err.response
          ? 'Cannot reach the server. Check your internet connection and try again.'
          : status === 401
            ? 'Invalid email or password. Check for typos and try again.'
            : status === 429
              ? 'Too many attempts. Wait 15 minutes and try again.'
              : err.response.data?.error || 'Login failed. Try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Dev-only shortcut — hidden in production builds.
  const quickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <div className="auth-split">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-logo">◈ FundsRoom ERP</div>
          <h2>Run sales, stock & customers from one calm dashboard.</h2>
          <p className="auth-brand-sub">Built for distributors, wholesalers and retail teams.</p>
          <div className="auth-perks">
            {PERKS.map((p) => (
              <div key={p.title} className="auth-perk">
                <span className="auth-perk-icon">{p.icon}</span>
                <div>
                  <div className="auth-perk-title">{p.title}</div>
                  <div className="auth-perk-desc">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="auth-brand-foot">Secure sign-in • Role-based access • Audit-trailed stock</div>
        </div>
      </aside>

      <main className="auth-form-side">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Welcome back</h1>
          <p className="auth-sub">Sign in with your work account to continue.</p>

          {error && <div className="error-message">{error}</div>}

          <label className="field-label" htmlFor="login-email">Work email</label>
          <input
            id="login-email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <label className="field-label" htmlFor="login-password">Password</label>
          <div className="pw-wrap">
            <input
              id="login-password"
              type={showPw ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading && <span className="spinner" aria-hidden />}
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>

          <p className="auth-switch">
            New here? <Link className="link" to="/signup">Create an account</Link>
          </p>

          {isDev && (
            <div className="demo-logins">
              <p>Dev only — seeded accounts (hidden in production)</p>
              <button type="button" onClick={() => quickLogin('admin@fundsroom.com')}>Admin</button>
              <button type="button" onClick={() => quickLogin('sales@fundsroom.com')}>Sales</button>
              <button type="button" onClick={() => quickLogin('warehouse@fundsroom.com')}>Warehouse</button>
              <button type="button" onClick={() => quickLogin('accounts@fundsroom.com')}>Accounts</button>
            </div>
          )}
        </form>
      </main>
    </div>
  );
};
