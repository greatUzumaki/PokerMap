"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@pokermap/ui/button";
import { Input } from "@pokermap/ui/input";
import { Label } from "@pokermap/ui/label";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState | undefined, FormData>(loginAction, undefined);

  return (
    <form action={formAction} className="grid gap-4">
      <div>
        <Label htmlFor="username">Логин</Label>
        <Input id="username" name="username" autoComplete="username" required defaultValue="admin" />
      </div>
      <div>
        <Label htmlFor="password">Пароль</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state && !state.ok ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </div>
      ) : null}
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Входим…" : "Войти"}
    </Button>
  );
}
