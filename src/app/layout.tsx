import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import { storageMode } from "@/lib/db";
import { loadPortfolio } from "@/lib/store";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Personal finance and investment portfolio for an investor in India",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const data = await loadPortfolio();
  return (
    <html suppressHydrationWarning lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <Shell hasSample={data.hasSample} ephemeral={storageMode() === "ephemeral"}>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
