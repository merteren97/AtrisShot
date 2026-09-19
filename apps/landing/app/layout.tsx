import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AtrisShot — Profesyonel Ekran Yakalama ve İşaretleme Stüdyosu",
  description:
    "AtrisShot; manyetik pencere algılama, akıllı sansürleme (blur), vektörel işaretleme ve yerel gizlilik odaklı profesyonel Tauri masaüstü ekran yakalama aracıdır.",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#181a1c" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem('atrisshot-site-theme');
                const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.documentElement.classList.toggle('dark', dark);
                document.documentElement.lang = localStorage.getItem('atrisshot-site-language') === 'en' ? 'en' : 'tr';
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
