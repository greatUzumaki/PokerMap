import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pokermap/ui/card";

export default function AuditPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Аудит</h1>
        <p className="text-sm text-muted-foreground">Журнал изменений и действий администраторов</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>В разработке</CardTitle>
          <CardDescription>
            Здесь появится таймлайн правок: кто и когда изменил статус клуба, добавил фотографии или удалил данные.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
