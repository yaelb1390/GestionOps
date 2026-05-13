import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegistration } from "./PwaRegistration";

export const metadata: Metadata = {
  title: "Claro FiberOptic Nexus",
  description: "Plataforma de inspección de averías",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Claro Nexus",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff0000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
