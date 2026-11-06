import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-x" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }} role="alert">
        <div style={{ fontSize: 72, fontWeight: 900, marginBottom: 8 }} className="grad-text" aria-hidden="true">
          404
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Halaman tidak ditemukan</h1>
        <p style={{ color: "var(--text-soft)", fontSize: 14, margin: "0 0 24px" }}>
          Halaman yang kamu cari mungkin sudah dipindahkan atau tidak pernah ada.
        </p>
        <Link href="/" className="btn btn-primary">
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
