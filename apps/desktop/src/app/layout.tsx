import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UiPreferencesProvider } from "@/lib/ui-preferences";

export const metadata: Metadata = {
  title: "AtrisShot",
  description: "Local-first screenshot capture, editing, history, and path workflows for Atris users.",
  applicationName: "AtrisShot",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/atris-shot-icon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#121916",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><UiPreferencesProvider>{children}</UiPreferencesProvider></body>
    </html>
  );
}
