import type { Metadata } from "next";
import { DevServiceWorkerGuard } from "@/components/dev-service-worker-guard";

import "./globals.css";

export const metadata: Metadata = {
  title: "DLL347",
  description: "Datu Lapu-Lapu Lodge No. 347 progressive web application.",
  applicationName: "DLL347",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/branding/dll347-icon-64.png", type: "image/png", sizes: "64x64" },
      { url: "/branding/dll347-icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/branding/dll347-icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: [{ url: "/branding/dll347-icon-64.png", type: "image/png", sizes: "64x64" }],
    apple: [{ url: "/branding/dll347-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: "#faf6f0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full">
        <DevServiceWorkerGuard />
        {children}
      </body>
    </html>
  );
}
