"use client";

import { toast } from "sonner";
import { useTheme, type Theme } from "@/hooks/useTheme";
import ThemeToggle from "@/components/ThemeToggle";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  const handleClearHistory = () => {
    // No backend endpoint exists yet — UI-only with an honest note.
    toast.info("Fitur hapus riwayat akan segera tersedia", {
      description: "Saat ini riwayat disimpan otomatis dan hanya terlihat olehmu.",
    });
  };

  return (
    <div className="container-x" style={{ paddingTop: 32, paddingBottom: 40, maxWidth: 720 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 20px" }}>Pengaturan</h1>

      {/* Appearance */}
      <section className="card fade-up" style={{ padding: 20, marginBottom: 16 }} aria-labelledby="settings-appearance">
        <h2 id="settings-appearance" style={{ margin: "0 0 12px", fontSize: 16 }}>🎨 Tampilan</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {(["dark", "light"] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              aria-pressed={theme === t}
              className="btn"
              style={{
                flex: 1,
                minWidth: 120,
                background: theme === t ? "var(--accent-gradient)" : "rgba(255,255,255,0.05)",
                color: theme === t ? "#fff" : "var(--text)",
                border: `1px solid ${theme === t ? "transparent" : "var(--border)"}`,
              }}
            >
              {t === "dark" ? "🌙 Mode Gelap" : "☀️ Mode Terang"}
            </button>
          ))}
          <ThemeToggle />
        </div>
      </section>

      {/* Data */}
      <section className="card" style={{ padding: 20, marginBottom: 16 }} aria-labelledby="settings-data">
        <h2 id="settings-data" style={{ margin: "0 0 12px", fontSize: 16 }}>🗂️ Data &amp; Riwayat</h2>
        <p style={{ fontSize: 13, color: "var(--text-soft)", margin: "0 0 12px" }}>
          Riwayat tonton disimpan di server dan hanya dapat diakses oleh akunmu.
        </p>
        <button type="button" className="btn btn-outline" style={{ borderColor: "var(--danger)", color: "var(--danger)" }} onClick={handleClearHistory}>
          Hapus Riwayat Tonton
        </button>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>
          Catatan: endpoint penghapusan riwayat belum tersedia. Tombol ini hanya tampilan.
        </p>
      </section>

      {/* About / disclaimer */}
      <section className="card" style={{ padding: 20, marginBottom: 16 }} aria-labelledby="settings-about">
        <h2 id="settings-about" style={{ margin: "0 0 12px", fontSize: 16 }}>ℹ️ Tentang Aniverse PRO</h2>
        <p style={{ fontSize: 13, color: "var(--text-soft)", margin: "0 0 10px", lineHeight: 1.6 }}>
          <strong>Aniverse PRO</strong> v1.0 — aplikasi demo streaming anime dengan sistem kunci tontonan,
          XP &amp; level, multi-server failover, dan login demo instan.
        </p>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, padding: 12, borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
          <strong style={{ color: "var(--warning)" }}>Disclaimer:</strong> Aniverse PRO adalah proyek demo.
          Semua video berasal dari server pihak ketiga atau sampel demo bebas royalti. Kami tidak menyimpan
          file video. Hak cipta anime, gambar, dan merek dagang milik pemilik masing-masing. Gunakan dengan
          bijak dan patuhi hukum hak cipta di wilayahmu.
        </div>
      </section>
    </div>
  );
}
