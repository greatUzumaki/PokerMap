import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pokermap/ui/card";

export default function MediaPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Медиа</h1>
        <p className="text-sm text-muted-foreground">Хранилище фотографий клубов и баннеров</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>В разработке</CardTitle>
          <CardDescription>
            Загрузка изображений в MinIO, превью и привязка к карточкам клубов появятся в следующих итерациях.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
