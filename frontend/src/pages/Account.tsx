import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

const ROLE_BLURB: Record<string, { icon: string; title: string; points: string[] }> = {
  admin: { icon: '🛡️', title: 'Admin — full access', points: ['Manage users & roles', 'All customers, products & challans', 'Stock adjustments & deletes'] },
  sales: { icon: '🤝', title: 'Sales — sell & follow up', points: ['Add & edit customers', 'Create, confirm & cancel challans', 'View products & dashboard'] },
  warehouse: { icon: '📦', title: 'Warehouse — guard the stock', points: ['Add & edit products', 'Stock IN / OUT with audit trail', 'View customers & challans'] },
  accounts: { icon: '🧾', title: 'Accounts — watch the numbers', points: ['Dashboard analytics & history', 'Challan & customer records', 'Change own password'] },
};

const strengthOf = (pw: string): { score: number; label: string } => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const label = score <= 2 ? 'Weak' : score === 3 ? 'Okay' : score === 4 ? 'Strong' : 'Excellent';
  return { score: Math.min(score, 5), label };
};

export const Account = () => {
  const { toast } = useToast();
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState({ cur: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);

  const strength = useMemo(() => strengthOf(form.newPassword), [form.newPassword]);
  const match = form.confirm.length === 0 ? null : form.newPassword === form.confirm;
  const valid = form.currentPassword.length > 0 && form.newPassword.length >= 8 && match === true;

  const initials = (user?.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const role = ROLE_BLURB[user?.role || 'sales'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      toast('Check the form — passwords must match and be 8+ characters', 'error');
      return;
    }
    setSaving(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
      toast('Password changed. Use it next time you sign in.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to change password', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <div>
            <h1>Account</h1>
            <p className="page-sub">Your profile, role permissions and password.</p>
          </div>
        </div>

        <div className="account-grid">
          <section className="card account-profile">
            <div className="avatar-xl" aria-hidden>{initials}</div>
            <h2>{user?.name}</h2>
            <p className="muted">{user?.email}</p>
            <span className={`role-badge-btn role-${user?.role}`}>{user?.role}</span>
            <div className="account-meta">
              <div><span>Member since</span><b>{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</b></div>
              <div><span>User ID</span><b>#{user?.id}</b></div>
            </div>
            <button className="btn-small" onClick={handleLogout}>Sign out on this device</button>
          </section>

          <section className="card">
            <div className="card-head">
              <div><h2>{role.icon} {role.title}</h2><p className="muted">What you can do in FundsRoom</p></div>
            </div>
            <ul className="perm-list">
              {role.points.map((p) => <li key={p}>✓ {p}</li>)}
            </ul>
            <p className="muted" style={{ marginTop: 10 }}>Need more access? Ask an admin to change your role in Users.</p>
          </section>

          <section className="card account-security">
            <div className="card-head">
              <div><h2>Change password</h2><p className="muted">Use 8+ characters with a mix of cases, numbers & symbols.</p></div>
            </div>
            <form className="form-grid form-grid-1" onSubmit={handleSubmit}>
              <div>
                <div className="field-label">Current password</div>
                <div className="pw-wrap">
                  <input type={show.cur ? 'text' : 'password'} required value={form.currentPassword}
                    onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} autoComplete="current-password" />
                  <button type="button" className="pw-toggle" onClick={() => setShow({ ...show, cur: !show.cur })} aria-label="Toggle current password">
                    {show.cur ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div>
                <div className="field-label">New password</div>
                <div className="pw-wrap">
                  <input type={show.next ? 'text' : 'password'} required minLength={8} value={form.newPassword}
                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })} autoComplete="new-password" />
                  <button type="button" className="pw-toggle" onClick={() => setShow({ ...show, next: !show.next })} aria-label="Toggle new password">
                    {show.next ? '🙈' : '👁️'}
                  </button>
                </div>
                {form.newPassword && (
                  <div className="pw-meter">
                    <div className="pw-meter-bar"><span style={{ width: `${strength.score * 20}%` }} className={`pw-s${strength.score}`} /></div>
                    <span className="pw-meter-label">{strength.label}</span>
                  </div>
                )}
              </div>
              <div>
                <div className="field-label">Confirm new password</div>
                <div className="pw-wrap">
                  <input type={show.confirm ? 'text' : 'password'} required value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" />
                  <button type="button" className="pw-toggle" onClick={() => setShow({ ...show, confirm: !show.confirm })} aria-label="Toggle confirm password">
                    {show.confirm ? '🙈' : '👁️'}
                  </button>
                </div>
                {match === false && <div className="pw-mismatch">Passwords do not match.</div>}
                {match === true && <div className="pw-match">Passwords match ✓</div>}
              </div>
              <div className="modal-actions">
                <button type="submit" disabled={saving || !valid}>{saving ? 'Saving…' : 'Change password'}</button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
};
