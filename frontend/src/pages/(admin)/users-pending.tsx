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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from "@gp/design-system";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalItems, page * pageSize);

  const pageUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return MOCK_USERS.slice(start, start + pageSize);
  }, [page, pageSize]);

  const visiblePages = useMemo(() => {
    if (totalPages <= 3) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    pages.add(page);

    return Array.from(pages).sort((a, b) => a - b);
  }, [page, totalPages]);

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

        <div className="border-t border-border px-4 py-3">
          <div className="flex flex-col gap-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
            <Pagination className="mx-auto w-auto justify-center md:mx-0 md:justify-start" dir="ltr">
              <PaginationContent className="flex-wrap">
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    size="default"
                    aria-label="Previous page"
                    className={page === 1 ? "pointer-events-none opacity-50" : ""}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                  >
                    <ChevronLeft className="size-4" />
                  </PaginationLink>
                </PaginationItem>

                {visiblePages.map((pageNumber, index) => {
                  const previousPage = visiblePages[index - 1];
                  const items = [];

                  if (index > 0 && previousPage !== undefined && pageNumber - previousPage > 1) {
                    items.push(
                      <PaginationItem key={`ellipsis-${previousPage}-${pageNumber}`}>
                        <PaginationEllipsis />
                      </PaginationItem>,
                    );
                  }

                  items.push(
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href="#"
                        isActive={pageNumber === page}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(pageNumber);
                        }}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>,
                  );

                  return items;
                })}

                <PaginationItem>
                  <PaginationLink
                    href="#"
                    size="default"
                    aria-label="Next page"
                    className={
                      page === totalPages ? "pointer-events-none opacity-50" : ""
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(totalPages, p + 1));
                    }}
                  >
                    <ChevronRight className="size-4" />
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>

            <div className="flex items-center gap-3">
              <span className="text-[11px]">
                {t("admin.common.rowsPerPage", "Rows per page")}
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setPage(1);
                  setPageSize(value);
                }}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-muted-foreground/90">
                {from}–{to} / {totalItems}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsersPending;
