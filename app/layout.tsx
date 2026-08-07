import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Order Desk | Warehouse Ordering",
  description: "Manage product catalogs, customer order requests, pro-formas, dispatch, and final invoices in one place.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
