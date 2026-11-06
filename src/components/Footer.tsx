import Link from "next/link";

/** Site footer. Server component (no interactivity needed). */
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        marginTop: 64,
        borderTop: "1px solid var(--border)",
        background: "var(--bg-soft)",
        padding: "32px 0 24px",
      }}
    >
      <div className="container-x" style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }}>
          <span className="grad-text">ANIVERSE</span> <span style={{ color: "var(--text-soft)" }}>PRO</span>
        </div>
        <nav style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", fontSize: 14 }}>
          <Link href="/">Beranda</Link>
          <Link href="/history">Riwayat</Link>
          <Link href="/dashboard">Dashboard XP</Link>
          <Link href="/settings">Pengaturan</Link>
          <Link href="/login">Login</Link>
        </nav>
        <p style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 640, margin: 0 }}>
          Aniverse PRO adalah aplikasi demo. Semua video disediakan oleh server pihak ketiga / sampel demo.
          Kami tidak menyimpan file video. Hak cipta materi milik pemilik masing-masing.
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>© {year} Aniverse PRO. Dibuat untuk tujuan demo.</p>
      </div>
    </footer>
  );
}
