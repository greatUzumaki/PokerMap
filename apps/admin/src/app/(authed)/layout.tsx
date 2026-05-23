import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/api/server";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.isAdmin) {
    redirect("/login");
  }
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-4">
      <header className="mb-6 flex items-center justify-between border-b pb-4">
        <Link href="/" className="text-xl font-semibold">
          PokerMap · Админка
        </Link>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{session.firstName ?? session.username ?? `tg:${session.telegramUserId}`}</span>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
