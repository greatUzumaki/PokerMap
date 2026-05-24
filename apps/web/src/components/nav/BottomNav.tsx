"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, List, Info } from "lucide-react";
import { cn } from "@pokermap/ui/cn";
import { useTelegramHaptics } from "@/hooks/useTelegramHaptics";

const items = [
  { href: "/", label: "Карта", icon: Map },
  { href: "/list", label: "Список", icon: List },
  { href: "/about", label: "О проекте", icon: Info },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { selection } = useTelegramHaptics();

  return (
    <nav
      aria-label="Основная навигация"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/80 backdrop-blur-xl",
        "md:inset-x-0 md:bottom-auto md:top-0 md:border-b md:border-t-0",
      )}
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around gap-1 px-2 safe-bottom md:safe-top md:px-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onClick={() => selection()}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "mx-auto my-2 flex h-12 max-w-[160px] flex-col items-center justify-center gap-0.5 rounded-full px-3 text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
