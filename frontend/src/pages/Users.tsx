import { useEffect, useState } from 'react';
import api from '../api/client';
import { Sidebar } from '../components/Sidebar';
import { Modal } from '../components/Modal';
import { RolePicker } from '../components/RolePicker';
import { useToast } from '../components/Toast';
import { SkeletonTable } from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';

interface AppUser {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

const ROLES = ['admin', 'sales', 'warehouse', 'accounts'];

export const Users = () => {
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'sales' });
  const [saving, setSaving] = useState(false);
  const [roleTarget, setRoleTarget] = useState<AppUser | null>(null);
  const [roleDraft, setRoleDraft] = useState('sales');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data.data);
    } catch {
      toast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/auth/register', form);
      toast(`Account created for ${form.email}`);
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'sales' });
      load();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to create user', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openRoleChange = (u: AppUser) => {
    setRoleTarget(u);
    setRoleDraft(u.role);
  };

  const handleRoleChange = async () => {
    if (!roleTarget) return;
    if (roleTarget.id === me?.id && roleDraft !== 'admin') {
      toast('You cannot remove your own admin role', 'error');
      return;
    }
    if (roleDraft === roleTarget.role) {
      setRoleTarget(null);
      return;
    }
    try {
      await api.patch(`/auth/users/${roleTarget.id}/role`, { role: roleDraft });
      toast(`${roleTarget.name} is now ${roleDraft}`);
      setRoleTarget(null);
      load();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to update role', 'error');
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <div>
            <h1>Users</h1>
            <p className="page-sub">Admin creates accounts and grants roles. Only admins can assign the admin role.</p>
          </div>
          <button onClick={() => setShowForm(true)}>+ New User</button>
        </div>

        {loading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <button className={`role-badge-btn role-${u.role}`} onClick={() => openRoleChange(u)} title="Change role">
                      {u.role} ✎
                    </button>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showForm && (
          <Modal title="Create user account (any role)" onClose={() => setShowForm(false)} wide>
            <form className="form-grid form-grid-1" onSubmit={handleCreate}>
              <input placeholder="Full name *" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input placeholder="Work email *" type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input placeholder="Temporary password (min 8) *" type="password" required minLength={8} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <div className="field-label">Role — admin grants full access</div>
              <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role })} roles={ROLES} />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
              </div>
            </form>
          </Modal>
        )}

        {roleTarget && (
          <Modal title={`Change role — ${roleTarget.name}`} onClose={() => setRoleTarget(null)} wide>
            <p className="muted">{roleTarget.email} is currently <b>{roleTarget.role}</b>. Pick a new role below.</p>
            <RolePicker value={roleDraft} onChange={setRoleDraft} roles={ROLES} />
            <div className="modal-actions">
              <button type="button" onClick={() => setRoleTarget(null)}>Cancel</button>
              <button type="button" onClick={handleRoleChange}>Save role</button>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
};
