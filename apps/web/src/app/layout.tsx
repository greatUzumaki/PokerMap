import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Montserrat } from "next/font/google";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { TelegramProvider } from "@/components/telegram/TelegramProvider";
import { BottomNav } from "@/components/nav/BottomNav";
import { MapStage } from "@/components/map/MapStage";
import { PageViewTracker } from "@/components/track/PageViewTracker";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: publicEnv.NEXT_PUBLIC_APP_NAME, template: `%s — ${publicEnv.NEXT_PUBLIC_APP_NAME}` },
  description: "Карта живых покер-клубов в Санкт-Петербурге",
  applicationName: publicEnv.NEXT_PUBLIC_APP_NAME,
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#13161c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${montserrat.variable} dark`}>
      <body className="bg-background text-foreground font-sans">
        <QueryProvider>
          <TelegramProvider>
            <Suspense fallback={null}>
              <MapStage />
            </Suspense>
            <Suspense fallback={null}>
              <PageViewTracker />
            </Suspense>
            <main className="relative z-10 flex min-h-app flex-col">{children}</main>
            <BottomNav />
          </TelegramProvider>
        </QueryProvider>
        <Toaster
          position="top-center"
          theme="dark"
          richColors
          closeButton
          expand
          visibleToasts={3}
          duration={3000}
          toastOptions={{ className: "pm-toast" }}
        />
      </body>
    </html>
  );
}
