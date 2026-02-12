import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
} from "@gp/design-system";

const MOCK_USERS = [
  { id: "1", email: "user1@example.com", name: "John Doe", status: "pending", createdAt: "2025-02-01" },
  { id: "2", email: "user2@example.com", name: "Jane Smith", status: "pending", createdAt: "2025-02-02" },
  { id: "3", email: "user3@example.com", name: "Ahmed Ali", status: "pending", createdAt: "2025-02-03" },
];

const UsersPending = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {t("admin.usersPending.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.usersPending.subtitle")}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableCaption>{t("admin.usersPending.caption")}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.usersPending.email")}</TableHead>
              <TableHead>{t("admin.usersPending.name")}</TableHead>
              <TableHead>{t("admin.usersPending.status")}</TableHead>
              <TableHead>{t("admin.usersPending.created")}</TableHead>
              <TableHead className="text-right">
                {t("admin.usersPending.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_USERS.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium text-foreground">
                  {user.email}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.name}
                </TableCell>
                <TableCell>
                  <Badge variant="warning">
                    {t("admin.usersPending.pending")}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.createdAt}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {t("admin.usersPending.approve")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2 border-border"
                  >
                    {t("admin.usersPending.reject")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UsersPending;
