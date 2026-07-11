import { useMemo, useState } from "react";
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
  PaginationBar,
} from "@gp/design-system";

const MOCK_USERS = [
  { id: "1", email: "user1@example.com", name: "John Doe", status: "pending", createdAt: "2025-02-01" },
  { id: "2", email: "user2@example.com", name: "Jane Smith", status: "pending", createdAt: "2025-02-02" },
  { id: "3", email: "user3@example.com", name: "Ahmed Ali", status: "pending", createdAt: "2025-02-03" },
  { id: "4", email: "user4@example.com", name: "Sara Hassan", status: "pending", createdAt: "2025-02-04" },
  { id: "5", email: "user5@example.com", name: "Mohammed Qasim", status: "pending", createdAt: "2025-02-05" },
];

const UsersPending = () => {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const totalItems = MOCK_USERS.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const pageUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return MOCK_USERS.slice(start, start + pageSize);
  }, [page, pageSize]);

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
      <div className="rounded-2xl border border-border/80 bg-card/95 shadow-elevated overflow-hidden">
        <Table>
          <TableCaption className="px-4 pb-3 pt-2 text-xs text-muted-foreground">
            {t("admin.usersPending.caption")}
          </TableCaption>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.usersPending.email")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.usersPending.name")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.usersPending.status")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.usersPending.created")}
              </TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.usersPending.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageUsers.map((user) => (
              <TableRow
                key={user.id}
                className="transition-colors hover:bg-muted/30/60"
              >
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
                <TableCell className="text-xs text-muted-foreground">
                  {user.createdAt}
                </TableCell>
                <TableCell className="text-right">
                  <div className="ml-auto flex w-full max-w-[240px] flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {t("admin.usersPending.approve")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-border"
                    >
                      {t("admin.usersPending.reject")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <PaginationBar
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          onPageSizeChange={(size) => {
            setPage(1);
            setPageSize(size);
          }}
          totalItems={totalItems}
          rowsPerPageLabel={t("admin.common.rowsPerPage", "Rows per page")}
          dir="ltr"
        />
      </div>
    </div>
  );
};

export default UsersPending;
