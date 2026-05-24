import { publicEnv } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pokermap/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pokermap/ui/tabs";
import { Separator } from "@pokermap/ui/separator";

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>{publicEnv.NEXT_PUBLIC_APP_NAME}</CardTitle>
          <CardDescription>Карта живых покер-клубов в Санкт-Петербурге</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="about" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="about">О проекте</TabsTrigger>
            </TabsList>
            <TabsContent value="about" className="space-y-4">
              <p className="leading-7 text-muted-foreground">
                Откройте бот в Telegram, чтобы получить полный доступ к карте и фильтрам.
              </p>
              <p className="leading-7">
                По вопросам и предложениям:{" "}
                <a
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  href={publicEnv.NEXT_PUBLIC_SUPPORT_TG}
                  target="_blank"
                  rel="noopener"
                >
                  поддержка
                </a>
                .
              </p>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Карта построена на данных © участники{" "}
                <a
                  className="underline"
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener"
                >
                  OpenStreetMap
                </a>
                .
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
