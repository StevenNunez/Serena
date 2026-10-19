import type { Metadata, Viewport } from "next";
import { Figtree, Gloock, Dancing_Script } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site-url";
import RegistrarSW from "@/components/RegistrarSW";

const body = Figtree({ variable: "--font-body", subsets: ["latin"] });
const script = Dancing_Script({ variable: "--font-script", subsets: ["latin"], weight: ["600"] });
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
    <html lang="es-CL" className={`${body.variable} ${title.variable} ${script.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
