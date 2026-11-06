import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@/styles/globals.css";
import "plyr/dist/plyr.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Providers from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Aniverse PRO — Streaming Anime",
    template: "%s — Aniverse PRO",
  },
  description:
    "Aniverse PRO — platform streaming anime dengan sistem kunci tontonan, XP & level, multi-server failover, dan login demo instan. Nikmati anime favoritmu tanpa ribet.",
  keywords: ["anime", "streaming", "nonton anime", "sub indo", "Aniverse"],
  openGraph: {
    type: "website",
    title: "Aniverse PRO — Streaming Anime",
    description: "Streaming anime dengan sistem kunci, XP/level, dan multi-server.",
    siteName: "Aniverse PRO",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aniverse PRO — Streaming Anime",
    description: "Streaming anime dengan sistem kunci, XP/level, dan multi-server.",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0b0b14",
  width: "device-width",
  initialScale: 1,
};

// Runs before hydration to prevent theme flash (FOUC).
const THEME_BOOTSTRAP_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem("aniverse-theme");
    if (t === "light" || t === "dark") {
      document.documentElement.dataset.theme = t;
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeCookie = cookies().get("theme")?.value;
  const initialTheme = themeCookie === "light" ? "light" : "dark";

  return (
    <html lang="id" data-theme={initialTheme}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <Providers>
          <Navbar />
          <main style={{ paddingTop: 64, minHeight: "calc(100vh - 64px)" }}>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
