"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Info, List, Map as MapIcon } from "lucide-react";
import { cn } from "@pokermap/ui/cn";
import { useTelegramHaptics } from "@/hooks/useTelegramHaptics";

type NavItem = {
  href: Route;
  label: string;
  icon: typeof MapIcon;
  kind: "side" | "center";
};

const items: readonly NavItem[] = [
  { href: "/list", label: "Список", icon: List, kind: "side" },
  { href: "/", label: "Карта", icon: MapIcon, kind: "center" },
  { href: "/about", label: "О проекте", icon: Info, kind: "side" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { selection } = useTelegramHaptics();
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const containerRef = useRef<HTMLUListElement | null>(null);
  const [pill, setPill] = useState<{ left: number; width: number; visible: boolean }>({
    left: 0,
    width: 0,
    visible: false,
  });

  useLayoutEffect(() => {
    const idx = items.findIndex((i) => i.href === pathname);
    const active = idx >= 0 ? items[idx] : undefined;
    if (!active || active.kind === "center") {
      setPill((p) => ({ ...p, visible: false }));
      return;
    }
    const node = itemRefs.current[idx];
    const parent = containerRef.current;
    if (!node || !parent) return;
    const r = node.getBoundingClientRect();
    const pr = parent.getBoundingClientRect();
    setPill({ left: r.left - pr.left, width: r.width, visible: true });
  }, [pathname]);

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-3 pt-2 safe-bottom"
    >
      <div className="relative flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-2 rounded-full bg-primary/15 transition-[transform,width,opacity] duration-300 ease-out will-change-transform",
            pill.visible ? "opacity-100" : "opacity-0",
          )}
          style={{ transform: `translateX(${pill.left}px)`, width: pill.width }}
        />
        <ul ref={containerRef} className="relative flex items-center gap-1">
          {items.map((item, i) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            const isCenter = item.kind === "center";
            return (
              <li key={item.href} className="flex items-center">
                <Link
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  href={item.href}
                  prefetch
                  onClick={() => selection()}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex items-center justify-center transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isCenter
                      ? cn(
                          "-my-4 mx-1 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 active:scale-95",
                          active
                            ? "scale-110 ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                            : "scale-100 hover:scale-105",
                        )
                      : cn(
                          "h-10 gap-2 rounded-full px-3 text-sm font-medium md:px-4",
                          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                        ),
                  )}
                >
                  <Icon
                    className={cn(
                      "transition-transform duration-300 ease-out",
                      isCenter ? "h-6 w-6" : "h-4 w-4",
                      !isCenter && active ? "scale-110" : "scale-100",
                    )}
                    aria-hidden
                  />
                  {isCenter ? (
                    <span className="sr-only">{item.label}</span>
                  ) : (
                    <span
                      className={cn(
                        "transition-[max-width,opacity,margin] duration-300 ease-out",
                        active
                          ? "ml-1 max-w-[10ch] opacity-100"
                          : "ml-0 max-w-[10ch] opacity-100 sm:opacity-100",
                      )}
                    >
                      {item.label}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
