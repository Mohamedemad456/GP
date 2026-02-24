import { Link } from "react-router-dom";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@gp/design-system";
import { useTranslation } from "react-i18next";
import { getAuthSession } from "@/lib/auth";

export default function ProfilePage() {
  const { t } = useTranslation();
  const session = getAuthSession();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-20 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("navigation.profile")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("navigation.account")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">User details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{session?.email ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="secondary">{session?.role ?? "-"}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Session created</span>
            <span className="font-medium">
              {session?.createdAt ? new Date(session.createdAt).toLocaleString() : "-"}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link to="/feed">
          <Button variant="outline">Go to feed</Button>
        </Link>
        <Link to="/seller">
          <Button variant="outline">Seller dashboard</Button>
        </Link>
        <Link to="/admin">
          <Button variant="outline">Admin dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

