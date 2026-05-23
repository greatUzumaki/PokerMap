"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hideBackButton, onBackButtonClick, showBackButton } from "@telegram-apps/sdk-react";

export function BackButtonBridge() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const root = pathname === "/" || pathname === "";
    try {
      if (root) {
        hideBackButton();
        return;
      }
      showBackButton();
      const off = onBackButtonClick(() => router.back());
      return () => off();
    } catch {
      // not in Telegram
    }
  }, [pathname, router]);

  return null;
}
