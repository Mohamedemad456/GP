import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Loader2,
  Search,
  ShieldOff,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Label,
  PaginationBar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@gp/design-system";
import { useToast } from "@/hooks/use-toast";
import {
  getAdminUsers,
  toggleUserStatus,
  type UserListDto,
  type UserListSpecParams,
} from "@/lib/adminApi";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const arabicFontStyle = {
  fontFamily: "'Cairo', 'Tajawal', 'IBM Plex Arabic', sans-serif",
} as const;

function formatDate(dateStr: string, formatter: Intl.DateTimeFormat) {
  return formatter.format(new Date(dateStr));
}

const AdminUsers = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("ar") ? "ar-SA" : "en-SA";
  const isArabic = i18n.language?.startsWith("ar");
  const { success, error } = useToast();

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [locale],
  );

  // State
  const [users, setUsers] = useState<UserListDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Toggle-status confirm dialog
  const [confirmTarget, setConfirmTarget] = useState<UserListDto | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: UserListSpecParams = {
        pageIndex: page,
        pageSize,
        ...(search ? { search } : {}),
        ...(statusFilter !== "all" ? { isActive: statusFilter === "active" } : {}),
      };
      const response = await getAdminUsers(params);
      if (response.success && response.data) {
        setUsers(response.data.data);
        setTotalItems(response.data.count);
      } else {
        error(t("admin.users.loadError"), { description: response.message });
      }
    } catch {
      error(t("admin.users.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, statusFilter, error, t]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  };

  const activeFilterCount = [search, statusFilter !== "all" ? statusFilter : ""].filter(Boolean).length;

  const handleToggleStatus = async () => {
    if (!confirmTarget) return;
    setIsActionLoading(true);
    try {
      const response = await toggleUserStatus(confirmTarget.userId);
      if (response.success) {
        success(
          confirmTarget.isActive
            ? t("admin.users.deactivateSuccess")
            : t("admin.users.activateSuccess"),
        );
        setConfirmTarget(null);
        await fetchUsers();
      } else {
        error(t("admin.users.toggleError"), { description: response.message });
      }
    } catch {
      error(t("admin.users.toggleError"));
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div
      className="space-y-6"
      dir={isArabic ? "rtl" : "ltr"}
      style={isArabic ? arabicFontStyle : undefined}
    >
      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
        {/* Header */}
        <div className="border-b border-border/70 bg-muted/20 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                <Users className="size-5" />
              </div>
              <div>
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  {t("admin.users.title")}
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t("admin.users.subtitle")}{" "}
                  <span className="font-semibold text-foreground">{totalItems}</span>{" "}
                  {t("admin.users.totalUsers")}
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("admin.users.search")}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("admin.users.searchPlaceholder")}
                  className="h-10 ps-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("admin.users.status")}</Label>
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val as "all" | "active" | "inactive");
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.users.allStatuses")}</SelectItem>
                  <SelectItem value="active">{t("admin.users.active")}</SelectItem>
                  <SelectItem value="inactive">{t("admin.users.inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
                className="h-10 gap-2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
                {t("admin.users.clearFilters")}
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <Table>
          <TableCaption className="px-4 pb-3 pt-2 text-xs text-muted-foreground">
            {t("admin.users.caption")}
          </TableCaption>
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/35 hover:bg-muted/35">
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.users.name")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.users.email")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.users.phone")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.users.statusCol")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.users.joined")}
              </TableHead>
              <TableHead className="py-3 text-end text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.users.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j} className="py-4">
                      <Skeleton className="h-5 w-full max-w-[160px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-20 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted/50 text-muted-foreground/45 ring-1 ring-border/50">
                      <Users className="size-7" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("admin.users.empty")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.userId}
                  className="border-border/50 transition-colors hover:bg-muted/20"
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 text-sm font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <p className="font-semibold text-foreground">{user.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-muted-foreground" dir="ltr">
                    {user.email}
                  </TableCell>
                  <TableCell className="py-4 text-muted-foreground" dir="ltr">
                    {user.phoneNumber ?? "—"}
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge variant={user.isActive ? "success" : "destructive"} className="rounded-full px-2.5 py-1">
                      {user.isActive ? t("admin.users.active") : t("admin.users.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4 text-sm text-muted-foreground">
                    {formatDate(user.createdAt, dateFormatter)}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`gap-1.5 rounded-xl border-border ${user.isActive ? "hover:border-destructive/50 hover:text-destructive" : "hover:border-success/50 hover:text-success"}`}
                        onClick={() => setConfirmTarget(user)}
                      >
                        {user.isActive ? (
                          <>
                            <ShieldOff className="size-4" />
                            {t("admin.users.deactivate")}
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-4" />
                            {t("admin.users.activate")}
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <PaginationBar
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(size) => {
            setPage(1);
            setPageSize(size);
          }}
          totalItems={totalItems}
          rowsPerPageLabel={t("admin.common.rowsPerPage", "Rows per page")}
          dir="ltr"
        />
      </div>

      {/* Confirm Toggle Dialog */}
      <Dialog
        open={!!confirmTarget}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              {confirmTarget?.isActive ? (
                <XCircle className="size-5 text-destructive" />
              ) : (
                <CheckCircle2 className="size-5 text-success" />
              )}
              {confirmTarget?.isActive
                ? t("admin.users.confirmDeactivateTitle")
                : t("admin.users.confirmActivateTitle")}
            </DialogTitle>
            <DialogDescription>
              {confirmTarget?.isActive
                ? t("admin.users.confirmDeactivateDesc", { name: confirmTarget?.name })
                : t("admin.users.confirmActivateDesc", { name: confirmTarget?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmTarget(null)}
              className="border-border"
            >
              {t("admin.users.cancel")}
            </Button>
            <Button
              variant={confirmTarget?.isActive ? "destructive" : "default"}
              onClick={() => void handleToggleStatus()}
              disabled={isActionLoading}
              className="gap-2"
            >
              {isActionLoading ? <Loader2 className="size-4 animate-spin" /> : null}
              {confirmTarget?.isActive
                ? t("admin.users.deactivate")
                : t("admin.users.activate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
