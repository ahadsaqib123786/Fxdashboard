export default function DashboardSkeleton() {
  return (
    <div>
      <div className="card skeleton-card">
        <div className="skeleton skeleton-circle" />
        <div className="skeleton skeleton-line skeleton-line-short" style={{ margin: "0 auto" }} />
      </div>
      <div className="card skeleton-card">
        <div className="skeleton skeleton-line skeleton-line-short" style={{ margin: "0 auto 12px" }} />
        <div className="skeleton skeleton-line skeleton-line-medium" style={{ margin: "0 auto 8px", height: 28 }} />
        <div className="skeleton skeleton-line skeleton-line-short" style={{ margin: "0 auto 8px", height: 18 }} />
        <div className="skeleton skeleton-line skeleton-line-medium" style={{ margin: "0 auto", height: 36 }} />
      </div>
      <div className="card skeleton-card">
        <div className="skeleton skeleton-line skeleton-line-short" style={{ margin: "0 auto 10px" }} />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line skeleton-line-medium" />
      </div>
      <div className="card skeleton-card">
        <div className="skeleton skeleton-line skeleton-line-short" style={{ margin: "0 auto 12px" }} />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line skeleton-line-medium" />
        <div className="skeleton skeleton-line" />
      </div>
    </div>
  );
}
