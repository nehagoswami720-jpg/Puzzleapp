import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit, Press_Start_2P, Space_Grotesk } from "next/font/google";
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

// Display face — a characterful grotesk with distinctive tabular-feeling digits,
// used for headings and titles. Body stays Geist Sans; numerals stay Geist Mono.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// v1 (arcade) type system: Outfit for text, Press Start 2P (pixel) for splash.
const outfit = Outfit({
  variable: "--font-outfit-var",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const pressStart = Press_Start_2P({
  variable: "--font-press-var",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Skill Puzzles",
  description:
    "Describe a skill you want to improve and get tailored, verified puzzles to practise it.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e0f13",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${outfit.variable} ${pressStart.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
