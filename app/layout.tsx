import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UnloadGuard } from "@/components/bluetooth/unload-guard";
import { AppUpdater } from "@/components/providers/app-updater";
import { OfflineNavigation } from "@/components/providers/offline-navigation";
import { Providers } from "@/components/providers/providers";
import { Footer } from "@/components/layout/footer";
import { TopNav } from "@/components/layout/top-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MS Connect",
  description: "MS Connect",
  applicationName: "MS Connect",
  appleWebApp: {
    capable: true,
    title: "MS Connect",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <TopNav />
          {children}
          <Footer />
          <AppUpdater />
          <OfflineNavigation />
          <UnloadGuard />
        </Providers>
      </body>
    </html>
  );
}
