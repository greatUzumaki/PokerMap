import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { TelegramProvider } from "@/components/telegram/TelegramProvider";
import { BottomNav } from "@/components/nav/BottomNav";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
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
    <html lang="ru" suppressHydrationWarning className={`${inter.variable} dark`}>
      <body className="bg-background text-foreground font-sans">
        <QueryProvider>
          <TelegramProvider>
            <main className="flex min-h-app flex-col">{children}</main>
            <BottomNav />
          </TelegramProvider>
        </QueryProvider>
        <Toaster position="top-center" theme="dark" richColors />
      </body>
    </html>
  );
}
