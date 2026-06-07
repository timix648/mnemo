import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Fraunces, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";
import { Analytics } from "@vercel/analytics/react";

// Body: Plus Jakarta Sans — friendly, rounded humanist sans (not Inter/Geist).
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Headings: Fraunces — warm, characterful display with soft optical curves.
// Reads premium + organic, which suits the "own your legacy" tone.
const heading = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

// Mono: kept for code/endpoint snippets (proxy URL, curl test, etc.).
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mnemo",
  description:
    "Search, restore, and inherit your AI conversations across every provider.",

  icons: { icon: [{ url: "/favicon.png", type: "image/png" }] },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${heading.variable} ${mono.variable}`}
    >
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}