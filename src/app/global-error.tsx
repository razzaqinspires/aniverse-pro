"use client";

/**
 * Root-level error boundary. Only renders when even the root layout itself
 * fails (e.g. SessionProvider crash). Must re-create <html>/<body>.
 */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="id" data-theme="dark">
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#0b0b14", color: "#f2f2f7", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: 420, textAlign: "center" }} role="alert">
            <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden="true">🔥</div>
            <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>Aplikasi mengalami gangguan</h1>
            <p style={{ color: "#a0a0b8", fontSize: 14, margin: "0 0 20px" }}>
              {error?.message || "Kesalahan fatal pada lapisan terluar aplikasi."}
            </p>
            <button
              type="button"
              onClick={() => {
                reset();
                window.setTimeout(() => window.location.reload(), 150);
              }}
              style={{
                background: "linear-gradient(135deg, #ff3d6e, #00e0ff)",
                color: "#fff",
                border: "none",
                padding: "10px 24px",
                borderRadius: 999,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
