import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AtrisShot",
  description: "Local-first screenshot capture, editing, history, and path workflows for your desktop.",
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
