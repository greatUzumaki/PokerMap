import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pokermap/ui/card";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="text-sm text-muted-foreground">Параметры приложения и команды администраторов</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>В разработке</CardTitle>
          <CardDescription>
            Управление администраторами, ключами API и интеграциями появится здесь после стабилизации каталога клубов.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
