"use client";

// Client-side providers wrapper. SessionProvider (next-auth) and Toaster (sonner)
// rely on React context and therefore MUST live in a client component, not in the
// server-component root layout.

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster richColors position="top-center" closeButton />
    </SessionProvider>
  );
}
