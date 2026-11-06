/** Global loading skeleton shown while route segments stream in. */
export default function GlobalLoading() {
  return (
    <div className="container-x" style={{ paddingTop: 32, paddingBottom: 32 }} aria-busy="true" aria-label="Memuat">
      <div className="skeleton" style={{ height: 220, marginBottom: 24, borderRadius: "var(--radius-lg)" }} />
      <div className="skeleton" style={{ height: 24, width: 180, marginBottom: 16 }} />
      <div className="anime-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skeleton" style={{ aspectRatio: "2/3", width: "100%" }} />
            <div className="skeleton" style={{ height: 12, width: "80%" }} />
            <div className="skeleton" style={{ height: 10, width: "40%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
