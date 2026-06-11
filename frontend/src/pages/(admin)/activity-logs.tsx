import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivitySquare,
  Calendar,
  Loader2,
  Search,
  SlidersHorizontal,
  Tag,
  User,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Label,
  PaginationBar,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@gp/design-system";
import { useToast } from "@/hooks/use-toast";
import {
  getAdminLogs,
  type AdminActivityLogDto,
  type AdminActivityLogSpecParams,
} from "@/lib/adminApi";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const ENTITY_TYPE_OPTIONS = [
  "Listing",
  "Make",
  "Model",
  "User",
  "ConditionCategory",
  "ConditionDefect",
];

const ACTION_OPTIONS = [
  "Approved",
  "Rejected",
  "Created",
  "Updated",
  "Deleted",
  "Activated",
  "Deactivated",
];

function actionVariant(action: string): "success" | "destructive" | "warning" | "secondary" | "info" {
  const a = action.toLowerCase();
  if (a.includes("approv") || a.includes("activat") || a.includes("creat")) return "success";
  if (a.includes("reject") || a.includes("delet") || a.includes("deactivat")) return "destructive";
  if (a.includes("updat")) return "warning";
  return "secondary";
}

function formatDate(dateStr: string, formatter: Intl.DateTimeFormat) {
  return formatter.format(new Date(dateStr));
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const AdminActivityLogs = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("ar") ? "ar-SA" : "en-SA";
  const isArabic = i18n.language?.startsWith("ar");
  const { error } = useToast();

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
  const [logs, setLogs] = useState<AdminActivityLogDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<AdminActivityLogDto | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activeFilterCount = [search, actionFilter, entityTypeFilter, dateFrom, dateTo].filter(Boolean).length;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: AdminActivityLogSpecParams = {
        pageIndex: page,
        pageSize,
        ...(search ? { search } : {}),
        ...(actionFilter ? { action: actionFilter } : {}),
        ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      };
      const response = await getAdminLogs(params);
      if (response.success && response.data) {
        setLogs(response.data.data);
        setTotalItems(response.data.count);
      } else {
        error(t("admin.activityLogs.loadError"), { description: response.message });
      }
    } catch {
      error(t("admin.activityLogs.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, actionFilter, entityTypeFilter, dateFrom, dateTo, error, t]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setActionFilter("");
    setEntityTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div
      className="space-y-6"
      dir={isArabic ? "rtl" : "ltr"}
      style={isArabic ? { fontFamily: "'Cairo', 'Tajawal', sans-serif" } : undefined}
    >
      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
        {/* Header */}
        <div className="border-b border-border/70 bg-muted/20 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-info/10 text-info ring-1 ring-inset ring-info/15">
                <ActivitySquare className="size-5" />
              </div>
              <div>
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  {t("admin.activityLogs.title")}
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t("admin.activityLogs.subtitle")}{" "}
                  <span className="font-semibold text-foreground">{totalItems}</span>{" "}
                  {t("admin.activityLogs.totalLogs")}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setFiltersOpen((open) => !open)}
              className="gap-2 rounded-xl border-border/80 bg-background"
            >
              <SlidersHorizontal className="size-4" />
              {t("admin.activityLogs.filters")}
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ms-1 rounded-full px-2 py-0.5">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>

          {filtersOpen && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_180px_180px_160px_160px_auto]">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("admin.activityLogs.searchAdmin")}</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={t("admin.activityLogs.searchPlaceholder")}
                    className="h-10 ps-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("admin.activityLogs.action")}</Label>
                <Select
                  value={actionFilter || "__all__"}
                  onValueChange={(val) => { setActionFilter(val === "__all__" ? "" : val); setPage(1); }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t("admin.activityLogs.allActions")}</SelectItem>
                    {ACTION_OPTIONS.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("admin.activityLogs.entityType")}</Label>
                <Select
                  value={entityTypeFilter || "__all__"}
                  onValueChange={(val) => { setEntityTypeFilter(val === "__all__" ? "" : val); setPage(1); }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t("admin.activityLogs.allEntities")}</SelectItem>
                    {ENTITY_TYPE_OPTIONS.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("admin.activityLogs.dateFrom")}</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="h-10"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("admin.activityLogs.dateTo")}</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="h-10"
                  dir="ltr"
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="h-10 gap-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                  {t("admin.activityLogs.clearFilters")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <Table>
          <TableCaption className="px-4 pb-3 pt-2 text-xs text-muted-foreground">
            {t("admin.activityLogs.caption")}
          </TableCaption>
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/35 hover:bg-muted/35">
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.activityLogs.admin")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.activityLogs.action")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.activityLogs.entityType")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.activityLogs.entityId")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.activityLogs.performedAt")}
              </TableHead>
              <TableHead className="py-3 text-end text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.activityLogs.details")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j} className="py-4">
                      <Skeleton className="h-5 w-full max-w-[140px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-20 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted/50 text-muted-foreground/45 ring-1 ring-border/50">
                      <ActivitySquare className="size-7" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("admin.activityLogs.empty")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer border-border/50 transition-colors hover:bg-muted/20"
                  onClick={() => setSelectedLog(log)}
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                        {log.adminName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">{log.adminName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge variant={actionVariant(log.action)} className="rounded-full px-2.5 py-1">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <Tag className="size-3" />
                      {log.entityType}
                    </span>
                  </TableCell>
                  <TableCell className="py-4 font-mono text-xs text-muted-foreground" dir="ltr">
                    {log.entityId.slice(0, 8)}…
                  </TableCell>
                  <TableCell className="py-4 text-sm text-muted-foreground">
                    {formatDate(log.performedAt, dateFormatter)}
                  </TableCell>
                  <TableCell className="py-4 text-end">
                    {log.details ? (
                      <span className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {log.details}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
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

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null); }}>
        {selectedLog && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading">
                <ActivitySquare className="size-5 text-info" />
                {t("admin.activityLogs.logDetail")}
              </DialogTitle>
              <DialogDescription>
                {t("admin.activityLogs.logDetailDesc")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoRow icon={User} label={t("admin.activityLogs.admin")} value={selectedLog.adminName} />
                <InfoRow icon={ActivitySquare} label={t("admin.activityLogs.action")} value={selectedLog.action} />
                <InfoRow icon={Tag} label={t("admin.activityLogs.entityType")} value={selectedLog.entityType} />
                <InfoRow icon={Calendar} label={t("admin.activityLogs.performedAt")} value={formatDateTime(selectedLog.performedAt)} />
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t("admin.activityLogs.entityId")}</p>
                <p className="font-mono text-sm text-foreground break-all" dir="ltr">{selectedLog.entityId}</p>
              </div>

              {selectedLog.details && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("admin.activityLogs.details")}</p>
                  <p className="text-sm text-foreground">{selectedLog.details}</p>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/25 p-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-background text-primary ring-1 ring-border/70">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default AdminActivityLogs;
