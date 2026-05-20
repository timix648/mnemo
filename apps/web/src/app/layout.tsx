import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mnemo — Your AI Memory",
  description: "Your AI memory, owned forever. Search, restore, and inherit your AI conversations across every provider.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geist.className} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}