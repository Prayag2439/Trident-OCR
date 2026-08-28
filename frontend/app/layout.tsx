import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trident — Challan & Despatch Console",
  description:
    "Professional challan management: upload challan images, OCR extraction with GPT-4o/Gemini, edit and map data, save to dashboard, export to Excel/CSV, and generate E-Way Bill JSON.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased min-h-screen flex flex-col bg-white text-gray-900 font-sans">
        {children}
      </body>
    </html>
  );
}

