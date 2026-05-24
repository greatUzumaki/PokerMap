import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pokermap/ui/card";
import { Button } from "@pokermap/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-app w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Клуб не найден</CardTitle>
          <CardDescription>
            Возможно, он был архивирован или ссылка устарела.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/">На карту</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
