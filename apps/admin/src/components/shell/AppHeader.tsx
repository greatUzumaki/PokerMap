"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut, User } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@pokermap/ui/breadcrumb";
import { Button } from "@pokermap/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pokermap/ui/dropdown-menu";
import { Separator } from "@pokermap/ui/separator";
import { SidebarTrigger } from "@pokermap/ui/sidebar";
import { logoutAction } from "@/app/login/actions";

const ROUTE_LABELS: Record<string, string> = {
  "": "Дашборд",
  clubs: "Клубы",
  new: "Новый клуб",
  media: "Медиа",
  audit: "Аудит",
  settings: "Настройки",
};

type Crumb = { label: string; href: string; current: boolean };

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [{ label: "Дашборд", href: "/", current: true }];
  }
  const crumbs: Crumb[] = [{ label: "Дашборд", href: "/", current: false }];
  let acc = "";
  segments.forEach((segment, idx) => {
    acc += `/${segment}`;
    const last = idx === segments.length - 1;
    const label = ROUTE_LABELS[segment] ?? decodeURIComponent(segment);
    crumbs.push({ label, href: acc, current: last });
  });
  return crumbs;
}

export function AppHeader({
  user,
}: {
  user: { firstName: string | null; username: string | null; telegramUserId: number };
}) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);
  const display = user.firstName ?? user.username ?? `tg:${user.telegramUserId}`;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-xl">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((c, i) => (
            <Fragment key={c.href}>
              <BreadcrumbItem>
                {c.current ? (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={c.href}>{c.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {i < crumbs.length - 1 ? (
                <BreadcrumbSeparator>
                  <ChevronRight className="h-3.5 w-3.5" />
                </BreadcrumbSeparator>
              ) : null}
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {display.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden sm:inline">{display}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{display}</span>
                <span className="text-xs text-muted-foreground">tg:{user.telegramUserId}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="h-4 w-4" />
              Профиль
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={logoutAction}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut className="h-4 w-4" />
                  Выйти
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
