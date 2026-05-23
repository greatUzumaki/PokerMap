import { redirect } from "next/navigation";
import { getSession } from "@/lib/api/server";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.isAdmin) {
    redirect("/");
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">PokerMap · Админка</h1>
        <p className="mb-6 text-sm text-muted-foreground">Войдите как суперадмин</p>
        <LoginForm />
      </div>
    </div>
  );
}
