import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@pokermap/ui/sidebar";
import { getSession } from "@/lib/api/server";
import { AppHeader } from "@/components/shell/AppHeader";
import { AppSidebar } from "@/components/shell/AppSidebar";

export const dynamic = "force-dynamic";

const SIDEBAR_COOKIE = "sidebar:state";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.isAdmin) {
    redirect("/login");
  }
  const store = await cookies();
  const defaultOpen = store.get(SIDEBAR_COOKIE)?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar user={session} />
      <SidebarInset>
        <AppHeader user={session} />
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
