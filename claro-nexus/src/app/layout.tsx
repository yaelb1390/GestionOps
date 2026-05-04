import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claro FiberOptic Nexus",
  description: "Plataforma de inspección de averías",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
