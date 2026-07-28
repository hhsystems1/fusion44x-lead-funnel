import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteContent } from "@/config/site-content";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteContent.seo.title,
    template: `%s | ${siteContent.company.name}`,
  },
  description: siteContent.seo.description,
  openGraph: {
    title: siteContent.seo.og_title,
    description: siteContent.seo.og_description,
    type: "website",
    siteName: siteContent.company.name,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <a
          href="#funnel-viewport"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-aqua focus:text-white focus:rounded"
        >
          Skip to assessment
        </a>
        <div id="main-content" role="main">
          {children}
        </div>
      </body>
    </html>
  );
}
