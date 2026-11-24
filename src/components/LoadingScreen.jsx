export default function LoadingScreen({ visible, progress }) {
  const amount = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div
      className={`loader ${visible ? "" : "is-done"}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <div className="loader-card">
        <p className="loader-mark">
          SCOOPY<span>.</span>
        </p>
        <p className="loader-copy">Warming the first scoop</p>
        <div className="loader-bar" aria-hidden="true">
          <span style={{ width: `${amount}%` }} />
        </div>
        <p className="loader-percent">{amount}%</p>
      </div>
    </div>
  );
}
