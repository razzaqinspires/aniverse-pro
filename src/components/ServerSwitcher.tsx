"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ServerHealth } from "@/lib/types";
import { apiFetch } from "@/hooks/useAnime";
import Skeleton from "./Skeleton";

interface ServerSwitcherProps {
  /** If omitted, the component fetches /api/health/servers itself. */
  servers?: ServerHealth[];
  currentServer?: string;
  onSelect: (serverId: string) => void;
  loading?: boolean;
}

/** Manual server selector with live health status. */
export default function ServerSwitcher({ servers: serversProp, currentServer, onSelect, loading }: ServerSwitcherProps) {
  const [internal, setInternal] = useState<ServerHealth[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (serversProp) return;
    let alive = true;
    apiFetch<{ servers: ServerHealth[] }>("/api/health/servers")
      .then((d) => {
        if (alive) setInternal(d.servers);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Gagal memuat daftar server");
      });
    return () => {
      alive = false;
    };
  }, [serversProp]);

  const servers = serversProp ?? internal;

  const handleSelect = (s: ServerHealth) => {
    if (s.id === currentServer) return;
    if (!s.ok) {
      toast.warning(`Server ${s.name} sedang bermasalah`, { description: "Tetap beralih? Mungkin gagal diputar." });
    }
    onSelect(s.id);
  };

  return (
    <div className="card" style={{ padding: 16 }} aria-label="Pilih server">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Ganti Server</h3>
        <span className="badge">{servers ? `${servers.length} server` : "—"}</span>
      </div>

      {loading || !servers ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton height={38} />
          <Skeleton height={38} />
        </div>
      ) : error ? (
        <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>
      ) : servers.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Tidak ada server tersedia.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {servers.map((s) => {
            const active = s.id === currentServer;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s)}
                aria-pressed={active}
                disabled={active}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${active ? "var(--accent-2)" : "var(--border)"}`,
                  background: active ? "rgba(0,224,255,0.08)" : "rgba(255,255,255,0.03)",
                  color: "var(--text)",
                  cursor: active ? "default" : "pointer",
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: s.ok ? "var(--success)" : "var(--danger)",
                    boxShadow: s.ok ? "0 0 8px var(--success)" : "none",
                  }}
                />
                <span style={{ flex: 1 }}>{s.name}</span>
                {s.isDemo ? <span className="badge" style={{ fontSize: 10 }}>DEMO</span> : null}
                {typeof s.latencyMs === "number" ? (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.latencyMs}ms</span>
                ) : null}
                {active ? <span style={{ fontSize: 11, color: "var(--accent-2)" }}>AKTIF</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
