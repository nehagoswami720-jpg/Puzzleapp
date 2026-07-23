import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Skill Puzzles",
  description:
    "Describe a skill you want to improve and get tailored, verified puzzles to practise it.",
};

// Mobile-first: design target is a ~380px viewport. `viewportFit: cover` and the
// PWA manifest/service worker follow in Phase 3.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eef2f7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
