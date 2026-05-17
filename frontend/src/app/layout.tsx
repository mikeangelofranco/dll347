import type { Metadata } from "next";
import { Cormorant_Garamond, IBM_Plex_Mono, Manrope } from "next/font/google";

import { DevServiceWorkerGuard } from "@/components/dev-service-worker-guard";

import "./globals.css";

const displaySerif = Cormorant_Garamond({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-body-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const manrope = Manrope({
  variable: "--font-body-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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
    <html
      lang="en"
      className={`${displaySerif.variable} ${ibmPlexMono.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <DevServiceWorkerGuard />
        {children}
      </body>
    </html>
  );
}
