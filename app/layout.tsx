import "./globals.css";
import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";
import { Toaster } from "@/lib/status";

export const metadata: Metadata = {
  title: "ระบบเบิกเสา",
  description: "จัดการกองหมอน เบิกเสา และแจ้งเตือน",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#0f766e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Nav />
        <Toaster />
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:pb-10">{children}</main>
      </body>
    </html>
  );
}
