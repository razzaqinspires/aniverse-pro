"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Global error boundary (Level 1) — catches rendering errors anywhere below the root. */
export default function AppError({ error, reset }: AppErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[GlobalError]", error);
    toast.error("Terjadi kesalahan tak terduga", { description: error?.message });
  }, [error]);

  const handleReload = () => {
    router.refresh();
    // Give the router a moment, then hard-reload for a clean slate.
    window.setTimeout(() => window.location.reload(), 150);
  };

  return (
    <div className="container-x" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="card" style={{ maxWidth: 480, margin: "0 auto", padding: 32, textAlign: "center" }} role="alert">
        <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden="true">💥</div>
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Terjadi kesalahan tak terduga</h1>
        <p style={{ color: "var(--text-soft)", fontSize: 14, margin: "0 0 24px" }}>
          {error?.message || "Sesuatu bermasalah. Coba muat ulang halaman."}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={handleReload}>
            Muat Ulang
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => reset()}>
            Coba Pulihkan
          </button>
        </div>
      </div>
    </div>
  );
}
