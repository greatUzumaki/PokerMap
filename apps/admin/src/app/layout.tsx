import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AuthProvider } from "@/components/AuthBridge";
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
  description: "Админ-панель PokerMap SPb",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0e14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${montserrat.variable} dark`}>
      <body className="bg-background text-foreground font-sans antialiased">
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
        <Toaster position="top-center" theme="dark" richColors />
      </body>
    </html>
  );
}
