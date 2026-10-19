import type { Metadata, Viewport } from "next";
import { Figtree, Gloock } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site-url";

const body = Figtree({ variable: "--font-body", subsets: ["latin"] });
const title = Gloock({ variable: "--font-title", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Tienda", template: "%s" },
  applicationName: "Tienda",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fa95b3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className={`${body.variable} ${title.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
