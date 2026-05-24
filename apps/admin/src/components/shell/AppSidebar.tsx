"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Image as ImageIcon, LayoutDashboard, LineChart, Settings, Users as UsersIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@pokermap/ui/sidebar";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const NAV: NavItem[] = [
  { label: "Дашборд", href: "/", icon: LayoutDashboard },
  { label: "Клубы", href: "/clubs", icon: Building2 },
  { label: "Медиа", href: "/media", icon: ImageIcon },
  { label: "Пользователи", href: "/users", icon: UsersIcon },
  { label: "Аналитика", href: "/analytics", icon: LineChart },
  { label: "Настройки", href: "/settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ user }: { user: { firstName: string | null; username: string | null; telegramUserId: number } }) {
  const pathname = usePathname();
  const display = user.firstName ?? user.username ?? `tg:${user.telegramUserId}`;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-12 items-center gap-2 rounded-md px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-sm font-bold">PM</span>
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">PokerMap</span>
            <span className="text-xs text-muted-foreground">Админ-панель</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Навигация</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href} prefetch>
                        <Icon className="h-4 w-4" aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-md p-2 text-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {display.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-medium">{display}</span>
            <span className="text-xs text-muted-foreground">админ</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
