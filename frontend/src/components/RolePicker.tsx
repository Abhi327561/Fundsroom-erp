interface RoleMeta {
  id: string;
  title: string;
  icon: string;
  desc: string;
}

export const ROLE_META: Record<string, RoleMeta> = {
  admin: { id: 'admin', title: 'Admin', icon: '🛡️', desc: 'Full access — users, roles, all modules & settings.' },
  sales: { id: 'sales', title: 'Sales', icon: '🤝', desc: 'Customers, pipeline & sales challans.' },
  warehouse: { id: 'warehouse', title: 'Warehouse', icon: '📦', desc: 'Products, stock IN/OUT & inventory.' },
  accounts: { id: 'accounts', title: 'Accounts', icon: '🧾', desc: 'Dashboard, challan history & reports.' },
};

interface Props {
  value: string;
  onChange: (role: string) => void;
  roles: string[];
}

// Big visual role picker — cards instead of a tiny dropdown.
export const RolePicker = ({ value, onChange, roles }: Props) => {
  return (
    <div className="role-grid" role="radiogroup" aria-label="Select role">
      {roles.map((r) => {
        const meta = ROLE_META[r];
        const selected = value === r;
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`role-card${selected ? ' role-selected' : ''}`}
            onClick={() => onChange(r)}
          >
            <span className="role-check" aria-hidden>{selected ? '●' : '○'}</span>
            <span className="role-icon" aria-hidden>{meta.icon}</span>
            <span className="role-title">{meta.title}</span>
            <span className="role-desc">{meta.desc}</span>
          </button>
        );
      })}
    </div>
  );
};
