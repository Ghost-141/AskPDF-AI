import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import "katex/dist/katex.min.css";

import { ThemeScript } from "@/components/ThemeScript";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AskPDF AI · Document Workspace",
  description: "A warm, focused workspace for asking questions about your documents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${serif.variable} ${mono.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}