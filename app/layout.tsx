import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";

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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    // iOS equivalent of display: standalone — a chromeless, fullscreen launch
    // from the home screen, with a dark status bar over the indigo header.
    capable: true,
    title: "Skill Puzzles",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

// Mobile-first: design target is a ~380px viewport. `viewportFit: "cover"` lets
// the layout extend under the notch/home indicator; the body then pads itself
// back in with the safe-area insets. Pinch-zoom is left enabled for
// accessibility — we don't set maximumScale.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6366f1",
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
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
