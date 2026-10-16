import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { RolePicker } from '../components/RolePicker';

const ROLES = ['sales', 'warehouse', 'accounts'];

export const Signup = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'sales' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/signup', form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/');
    } catch (err: any) {
      if (!err.response) {
        setError('Cannot reach the server. Check your internet connection and try again.');
      } else if (err.response.status === 404) {
        setError('This server version does not support signup yet. Please contact your administrator.');
      } else {
        setError(err.response.data?.error || 'Signup failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card login-card-wide" onSubmit={handleSubmit}>
        <h1>Create account</h1>
        <p>Choose your work role — admin access is granted later by an administrator.</p>

        {error && <div className="error-message">{error}</div>}

        <input placeholder="Full name" required value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
        <input type="email" placeholder="Work email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
        <input type="password" placeholder="Password (min 8 characters)" required minLength={8} value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />

        <div className="field-label">Your role</div>
        <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role })} roles={ROLES} />

        <button type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create account'}
        </button>

        <p style={{ textAlign: 'center' }}>
          Already have an account? <Link className="link" to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
};
