// Structured shimmer placeholders that mirror real cards,
// so loading feels like content sliding into place.
export const SkeletonStat = () => (
  <div className="stat-card sk-stat">
    <span className="skeleton sk-icon" />
    <div className="sk-lines">
      <div className="skeleton sk-line sk-w40" />
      <div className="skeleton sk-line sk-w70" />
    </div>
  </div>
);

export const SkeletonBars = () => (
  <div className="sk-chart">
    <div className="skeleton sk-line sk-w50" />
    <div className="sk-bars">
      {[70, 45, 85, 55, 95, 60, 78, 40, 66, 52, 80, 48].map((h, i) => (
        <span key={i} className="skeleton sk-bar" style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  </div>
);

export const SkeletonPie = () => (
  <div className="sk-chart sk-chart-center">
    <div className="skeleton sk-line sk-w50" />
    <div className="skeleton sk-pie" />
    <div className="skeleton sk-line sk-w70" />
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div className="sk-table">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="sk-row" style={{ animationDelay: `${r * 0.06}s` }}>
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="skeleton sk-line" style={{ flex: c === 0 ? 2 : 1 }} />
        ))}
      </div>
    ))}
  </div>
);

