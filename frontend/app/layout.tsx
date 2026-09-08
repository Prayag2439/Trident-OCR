import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";

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

export const viewport: Viewport = {
  themeColor: "#1a237e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};


export const metadata: Metadata = {
  title: "Trident Fabricators",
  description: "Enterprise-grade challan and despatch document extraction pipeline.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Trident Fabricators",
  },
  icons: {
    apple: "/trident-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                window.__deferredPrompt = null;
                window.addEventListener('beforeinstallprompt', function(e) {
                  e.preventDefault();
                  window.__deferredPrompt = e;
                  window.dispatchEvent(new CustomEvent('pwa-prompt-ready', { detail: e }));
                });
                window.addEventListener('appinstalled', function() {
                  window.__deferredPrompt = null;
                  console.log('[PWA] App installed');
                });
                function registerSW() {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function(reg) {
                      console.log('[PWA] ServiceWorker registered:', reg.scope);
                    }).catch(function(err) {
                      console.warn('[PWA] ServiceWorker registration failed:', err);
                    });
                  }
                }
                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  registerSW();
                } else {
                  window.addEventListener('DOMContentLoaded', registerSW);
                  window.addEventListener('load', registerSW);
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-white text-gray-900 font-sans">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
