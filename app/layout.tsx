import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Desi Kitchen | Wholesale Ordering",
  description: "Desi Kitchen wholesale catalog, customer order requests, estimates, and inventory management.",
  icons: { icon: "/desi-kitchen-logo.png", shortcut: "/desi-kitchen-logo.png", apple: "/desi-kitchen-logo.png" },
  other: { "application-release": "2026-08-13-adaptive-pdf-v2" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
