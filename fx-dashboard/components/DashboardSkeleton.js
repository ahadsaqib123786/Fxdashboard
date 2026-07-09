export default function DashboardSkeleton() {
  return (
    <div>
      <div className="skeleton skeleton-line" style={{ width: "40%" }} />
      <div className="card">
        <div className="skeleton skeleton-line" style={{ width: "30%" }} />
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-line" style={{ width: "90%" }} />
        <div className="skeleton skeleton-line" style={{ width: "70%" }} />
      </div>
      <div className="card">
        <div className="skeleton skeleton-line" style={{ width: "25%" }} />
        <div className="skeleton skeleton-line" style={{ width: "100%" }} />
        <div className="skeleton skeleton-line" style={{ width: "100%" }} />
        <div className="skeleton skeleton-line" style={{ width: "100%" }} />
      </div>
    </div>
  );
}
