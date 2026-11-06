"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import KeyHUD from "./KeyHUD";
import XpRing from "./XpRing";
import ThemeToggle from "./ThemeToggle";

const NAV_LINKS = [
  { href: "/", label: "Beranda" },
  { href: "/history", label: "Riwayat" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Pengaturan" },
];

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export default function Navbar() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const user = session?.user;

  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!dropdownOpen) return;
    const onDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [dropdownOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    setMenuOpen(false);
    setMobileSearchOpen(false);
    if (q) {
      router.push(`/?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/");
    }
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    toast.info("Keluar...");
    await signOut({ callbackUrl: "/" });
  };

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "color-mix(in srgb, var(--bg) 80%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="container-x" style={{ display: "flex", alignItems: "center", gap: 12, height: 64 }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }} aria-label="Aniverse PRO Beranda">
          <span
            aria-hidden="true"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--accent-gradient)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 900,
              fontSize: 16,
            }}
          >
            A
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: 0.5 }}>
            <span className="grad-text">ANIVERSE</span> <span style={{ color: "var(--text-soft)", fontSize: 13 }}>PRO</span>
          </span>
        </Link>

        {/* Desktop search */}
        <form onSubmit={submitSearch} role="search" style={{ flex: 1, maxWidth: 420, margin: "0 auto", display: "none" }} className="navbar-search-desktop">
          <div style={{ position: "relative" }}>
            <input
              type="search"
              className="input"
              placeholder="Cari anime, judul, genre..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Cari anime"
              style={{ paddingLeft: 40 }}
            />
            <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
        </form>

        {/* Right cluster */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "none" }} className="navbar-hud-desktop">
            <KeyHUD />
          </div>
          <div style={{ display: "none" }} className="navbar-xp-desktop">
            <XpRing />
          </div>
          <ThemeToggle />

          {/* Mobile search toggle */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen((v) => !v)}
            aria-label="Cari anime"
            aria-expanded={mobileSearchOpen}
            style={{ width: 38, height: 38, borderRadius: "var(--radius-full)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", background: "rgba(255,255,255,0.05)", color: "var(--text)" }}
            className="hud-chip navbar-search-toggle"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </button>

          {/* Auth area */}
          {status === "loading" ? (
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: "50%" }} aria-hidden="true" />
          ) : !user ? (
            <Link href="/login" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
              Login
            </Link>
          ) : (
            <div ref={dropdownRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                aria-label="Menu akun"
                aria-expanded={dropdownOpen}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: 4, borderRadius: "var(--radius-full)" }}
              >
                {user.image ? (
                  <img src={user.image} alt="" width={34} height={34} style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid var(--accent-2)" }} referrerPolicy="no-referrer" />
                ) : (
                  <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--accent-gradient)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
                    {initialsOf(user.name)}
                  </span>
                )}
                <span style={{ display: "none", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 600 }} className="navbar-username-desktop">
                  {user.name || user.email || "Pengguna"}
                </span>
              </button>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="card"
                    style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", minWidth: 220, padding: 8, zIndex: 60, boxShadow: "var(--shadow-lg)" }}
                    role="menu"
                  >
                    <div style={{ padding: "8px 12px 12px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name || "Pengguna"}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email || "—"}</div>
                      {user.isDemo ? <span className="badge" style={{ marginTop: 6 }}>Akun Demo</span> : null}
                    </div>
                    {[
                      { href: "/profile", label: "Profil", icon: "👤" },
                      { href: "/dashboard", label: "Dashboard XP", icon: "📊" },
                      { href: "/history", label: "Riwayat Tonton", icon: "🕘" },
                      { href: "/settings", label: "Pengaturan", icon: "⚙️" },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        onClick={() => setDropdownOpen(false)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: "var(--radius-sm)", fontSize: 14 }}
                        className="navbar-dropdown-item"
                      >
                        <span aria-hidden="true">{item.icon}</span> {item.label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", fontSize: 14, background: "transparent", border: "none", color: "var(--danger)", textAlign: "left" }}
                      className="navbar-dropdown-item"
                    >
                      <span aria-hidden="true">🚪</span> Keluar
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Buka menu"
            aria-expanded={menuOpen}
            style={{ width: 38, height: 38, borderRadius: "var(--radius-full)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", background: "rgba(255,255,255,0.05)", color: "var(--text)" }}
            className="navbar-hamburger"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile search bar (expandable) */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden", borderTop: "1px solid var(--border)" }}
          >
            <div className="container-x" style={{ padding: "10px 16px" }}>
              <form onSubmit={submitSearch} role="search">
                <input
                  type="search"
                  className="input"
                  placeholder="Cari anime..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Cari anime"
                  autoFocus
                />
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile menu panel */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden", borderTop: "1px solid var(--border)", background: "var(--bg-soft)" }}
            aria-label="Menu navigasi"
          >
            <div className="container-x" style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", gap: 12, padding: "8px 0", alignItems: "center" }}>
                <KeyHUD />
                <XpRing />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Kunci &amp; XP</span>
              </div>
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  style={{ padding: "12px 8px", borderRadius: "var(--radius-sm)", fontSize: 15, fontWeight: 600, borderBottom: "1px solid var(--border)" }}
                >
                  {l.label}
                </Link>
              ))}
              {!user ? (
                <Link href="/login" onClick={() => setMenuOpen(false)} className="btn btn-primary" style={{ marginTop: 12 }}>
                  Login / Daftar
                </Link>
              ) : null}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Inline responsive rules (kept here to avoid touching globals.css) */}
      <style>{`
        @media (min-width: 768px) {
          .navbar-search-desktop { display: block !important; }
          .navbar-hud-desktop { display: inline-flex !important; }
          .navbar-xp-desktop { display: inline-flex !important; }
          .navbar-username-desktop { display: inline-block !important; }
          .navbar-search-toggle { display: none !important; }
          .navbar-hamburger { display: none !important; }
        }
        .navbar-dropdown-item:hover { background: var(--bg-hover); }
      `}</style>
    </header>
  );
}
