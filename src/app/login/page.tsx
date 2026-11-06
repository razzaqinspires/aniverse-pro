"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [busy, setBusy] = useState<"demo" | "google" | null>(null);

  // Already logged in → go home.
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  const loginDemo = async () => {
    setBusy("demo");
    try {
      await signIn("demo", { callbackUrl: "/" });
      // signIn redirects on success; if it returns, something went wrong.
    } catch {
      toast.error("Gagal login demo. Coba lagi.");
      setBusy(null);
    }
  };

  const loginGoogle = async () => {
    setBusy("google");
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch {
      toast.error("Gagal login Google. Coba lagi.");
      setBusy(null);
    }
  };

  if (status === "authenticated" || status === "loading") {
    return (
      <div className="container-x" style={{ paddingTop: 120, display: "flex", justifyContent: "center" }}>
        <div className="spinner" role="status" aria-label="Memuat" />
      </div>
    );
  }

  return (
    <div className="container-x" style={{ paddingTop: 60, paddingBottom: 60, display: "flex", justifyContent: "center" }}>
      <div className="card fade-up" style={{ width: "100%", maxWidth: 420, padding: 32, textAlign: "center" }}>
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "var(--accent-gradient)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 900,
            fontSize: 28,
            marginBottom: 16,
          }}
        >
          A
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontFamily: "var(--font-display)" }}>
          Masuk ke <span className="grad-text">Aniverse PRO</span>
        </h1>
        <p style={{ color: "var(--text-soft)", fontSize: 14, margin: "0 0 24px" }}>
          Simpan riwayat tonton, kumpulkan XP &amp; level, dan buka kunci tontonan.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={loginDemo}
            disabled={busy !== null}
            style={{ fontSize: 16, padding: "14px 20px", width: "100%" }}
          >
            {busy === "demo" ? "Memproses..." : "⚡ Login Demo / Guest (Langsung Jadi)"}
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={loginGoogle}
            disabled={busy !== null}
            style={{ fontSize: 15, padding: "12px 20px", width: "100%" }}
          >
            {busy === "google" ? "Memproses..." : "🔐 Login dengan Google"}
          </button>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
            Jika Google belum dikonfigurasi di server, tombol ini akan menampilkan halaman error NextAuth — gunakan Login Demo.
          </p>
        </div>

        <div style={{ marginTop: 20, padding: 12, borderRadius: "var(--radius-md)", background: "rgba(0,224,255,0.08)", border: "1px solid rgba(0,224,255,0.25)", fontSize: 12, color: "var(--text-soft)", textAlign: "left" }}>
          <strong style={{ color: "var(--accent-2)" }}>Bonus:</strong> Login Demo tanpa setup apa pun — dapat{" "}
          <strong>3 kunci awal gratis</strong> langsung untuk menonton. Tonton iklan singkat untuk menambah kunci kapan saja.
        </div>
      </div>
    </div>
  );
}
