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
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur",
        "md:inset-x-0 md:bottom-auto md:top-0 md:border-b md:border-t-0",
      )}
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around safe-bottom md:safe-top">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onClick={() => selection()}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 text-xs",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
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
