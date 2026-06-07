import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  Car,
  CheckCircle2,
  DollarSign,
  Gauge,
  Loader2,
  Search,
  SlidersHorizontal,
  User,
  X,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  PaginationBar,
  Separator,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@gp/design-system";

import { useToast } from "@/hooks/use-toast";
import {
  getPendingListings,
  type PendingListingDto,
  type PendingListingSpecParams,
} from "@/lib/adminApi";
import { approveListing, rejectListing } from "@/lib/adminApi";
import { getAllMakes, type MakeDto } from "@/lib/makesApi";
import { getAllModels, type ModelDto } from "@/lib/modelsApi";

type DateFilter = {
  from: string;
  to: string;
};

const PAGE_SIZE_OPTIONS = [5, 10] as const;
const arabicFontStyle = {
  fontFamily: "'Cairo', 'Tajawal', 'IBM Plex Arabic', sans-serif",
} as const;

function formatPrice(price: number | null, formatter: Intl.NumberFormat) {
  if (price == null) return "—";
  return formatter.format(price);
}

function formatDate(dateStr: string, formatter: Intl.DateTimeFormat) {
  return formatter.format(new Date(dateStr));
}

function formatMileage(km: number, formatter: Intl.NumberFormat) {
  return `${formatter.format(km)} km`;
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Car;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/25 p-3">
      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-primary ring-1 ring-border/70">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="wrap-break-word text-sm font-semibold text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

const CarsPending = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("ar") ? "ar-SA" : "en-SA";
  const isArabic = i18n.language?.startsWith("ar");
  const { success, error } = useToast();
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "SAR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale),
    [locale],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [locale],
  );

  const [listings, setListings] = useState<PendingListingDto[]>([]);
  const [makes, setMakes] = useState<MakeDto[]>([]);
  const [models, setModels] = useState<ModelDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [makeFilter, setMakeFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [sellerFilterInput, setSellerFilterInput] = useState("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    from: "",
    to: "",
  });

  const [selectedListing, setSelectedListing] =
    useState<PendingListingDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingListingDto | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activeFilterCount = [
    makeFilter,
    modelFilter,
    sellerFilter,
    dateFilter.from,
    dateFilter.to,
  ].filter(Boolean).length;

  const makeOptions = useMemo(
    () =>
      makes.map((make) => ({
        value: make.id,
        label: make.name,
        disabled: false,
      })),
    [makes],
  );

  const modelOptions = useMemo(
    () =>
      models
        .filter((model) => !makeFilter || model.makeId === makeFilter)
        .map((model) => ({
          value: model.id,
          label: model.name,
          disabled: false,
        })),
    [makeFilter, models],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setSellerFilter(sellerFilterInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [sellerFilterInput]);

  const fetchFilters = useCallback(async () => {
    try {
      const [makesRes, modelsRes] = await Promise.all([
        getAllMakes(),
        getAllModels(),
      ]);

      if (makesRes.success) setMakes(makesRes.data?.data ?? []);
      if (modelsRes.success) setModels(modelsRes.data?.data ?? []);
    } catch {
      // Filter metadata is non-critical; the table can still load by itself.
    }
  }, []);

  const fetchPendingListings = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: PendingListingSpecParams = {
        pageIndex: page,
        pageSize,
        ...(makeFilter ? { makeId: makeFilter } : {}),
        ...(modelFilter ? { modelId: modelFilter } : {}),
        ...(sellerFilter ? { sellerId: sellerFilter } : {}),
        ...(dateFilter.from ? { dateFrom: dateFilter.from } : {}),
        ...(dateFilter.to ? { dateTo: dateFilter.to } : {}),
      };
      const response = await getPendingListings(params);
      if (response.success && response.data) {
        setListings(response.data.data);
        setTotalItems(response.data.count);
      } else {
        error(t("admin.carsPending.loadError"), {
          description: response.message,
        });
      }
    } catch {
      error(t("admin.carsPending.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [
    dateFilter.from,
    dateFilter.to,
    error,
    makeFilter,
    modelFilter,
    page,
    pageSize,
    sellerFilter,
    t,
  ]);

  useEffect(() => {
    void fetchFilters();
  }, [fetchFilters]);
  useEffect(() => {
    void fetchPendingListings();
  }, [fetchPendingListings]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const clearFilters = () => {
    setMakeFilter("");
    setModelFilter("");
    setSellerFilterInput("");
    setSellerFilter("");
    setDateFilter({ from: "", to: "" });
    setPage(1);
  };

  const handleApprove = async (listing: PendingListingDto) => {
    setIsActionLoading(true);
    try {
      const response = await approveListing(listing.id);
      if (response.success) {
        success(t("admin.carsPending.approveSuccess"));
        setSelectedListing(null);
        await fetchPendingListings();
      } else {
        error(t("admin.carsPending.approveError"), {
          description: response.message,
        });
      }
    } catch {
      error(t("admin.carsPending.approveError"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setIsActionLoading(true);
    try {
      const response = await rejectListing(rejectTarget.id, {
        reason: rejectReason.trim() || undefined,
      });
      if (response.success) {
        success(t("admin.carsPending.rejectSuccess"));
        setRejectTarget(null);
        setSelectedListing(null);
        setRejectReason("");
        await fetchPendingListings();
      } else {
        error(t("admin.carsPending.rejectError"), {
          description: response.message,
        });
      }
    } catch {
      error(t("admin.carsPending.rejectError"));
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
        <div className="border-b border-border/70 bg-muted/20 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning ring-1 ring-inset ring-warning/15">
                <Car className="size-5" />
              </div>
              <div>
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  {t("admin.carsPending.title")}
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t("admin.carsPending.subtitle")}{" "}
                  <span className="font-semibold text-foreground">
                    {totalItems}
                  </span>{" "}
                  {t("admin.carsPending.listingsAwaiting")}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setFiltersOpen((open) => !open)}
              className="gap-2 rounded-xl border-border/80 bg-background"
            >
              <SlidersHorizontal className="size-4" />
              {t("admin.carsPending.filters")}
              {activeFilterCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ms-1 rounded-full px-2 py-0.5"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>

          {filtersOpen && (
            <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_160px_160px_auto]">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t("admin.carsPending.make")}
                </Label>
                <Combobox
                  options={makeOptions}
                  value={makeFilter}
                  onValueChange={(value) => {
                    setMakeFilter(value);
                    setModelFilter("");
                    setPage(1);
                  }}
                  placeholder={t("admin.carsPending.allMakes")}
                  searchPlaceholder={t("admin.carsPending.searchMake")}
                  emptyText={t("admin.carsPending.noMakeFound")}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t("admin.carsPending.model")}
                </Label>
                <Combobox
                  options={modelOptions}
                  value={modelFilter}
                  onValueChange={(value) => {
                    setModelFilter(value);
                    setPage(1);
                  }}
                  placeholder={t("admin.carsPending.allModels")}
                  searchPlaceholder={t("admin.carsPending.searchModel")}
                  emptyText={t("admin.carsPending.noModelFound")}
                  disabled={!makeFilter}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t("admin.carsPending.sellerId")}
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    value={sellerFilterInput}
                    onChange={(event) =>
                      setSellerFilterInput(event.target.value)
                    }
                    placeholder={t("admin.carsPending.sellerIdPlaceholder")}
                    className="h-10 ps-9"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t("admin.carsPending.dateFrom")}
                </Label>
                <Input
                  type="date"
                  value={dateFilter.from}
                  onChange={(event) => {
                    setDateFilter((current) => ({
                      ...current,
                      from: event.target.value,
                    }));
                    setPage(1);
                  }}
                  className="h-10"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t("admin.carsPending.dateTo")}
                </Label>
                <Input
                  type="date"
                  value={dateFilter.to}
                  onChange={(event) => {
                    setDateFilter((current) => ({
                      ...current,
                      to: event.target.value,
                    }));
                    setPage(1);
                  }}
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
                  {t("admin.carsPending.clearFilters")}
                </Button>
              </div>
            </div>
          )}
        </div>

        <Table>
          <TableCaption className="px-4 pb-3 pt-2 text-xs text-muted-foreground">
            {t("admin.carsPending.caption")}
          </TableCaption>
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/35 hover:bg-muted/35">
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.carsPending.vehicle")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.carsPending.year")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.carsPending.mileage")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.carsPending.price")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.carsPending.fairPrice")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.carsPending.seller")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.carsPending.created")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.carsPending.status")}
              </TableHead>
              <TableHead className="py-3 text-end text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.carsPending.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: Math.min(pageSize, 5) }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 9 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex} className="py-4">
                      <Skeleton className="h-5 w-full max-w-[140px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : listings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-20 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted/50 text-muted-foreground/45 ring-1 ring-border/50">
                      <Car className="size-7" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("admin.carsPending.empty")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              listings.map((listing) => (
                <TableRow
                  key={listing.id}
                  className="cursor-pointer border-border/50 transition-colors hover:bg-muted/20"
                  onClick={() => setSelectedListing(listing)}
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                        <Car className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {listing.make} {listing.model}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          #{listing.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-muted-foreground">
                    {listing.year}
                  </TableCell>
                  <TableCell className="py-4 text-muted-foreground">
                    {formatMileage(listing.mileage, numberFormatter)}
                  </TableCell>
                  <TableCell className="py-4 font-semibold text-foreground">
                    {formatPrice(listing.price, currencyFormatter)}
                  </TableCell>
                  <TableCell className="py-4 text-muted-foreground">
                    {formatPrice(listing.fairPrice, currencyFormatter)}
                  </TableCell>
                  <TableCell className="py-4">
                    <div>
                      <p className="font-medium text-foreground">
                        {listing.sellerName || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {listing.sellerId}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-muted-foreground">
                    {formatDate(listing.createdAt, dateFormatter)}
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge
                      variant="warning"
                      className="rounded-full px-2.5 py-1"
                    >
                      {listing.status || t("admin.carsPending.pending")}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4">
                    <div
                      className="flex items-center justify-end gap-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        className="gap-1.5 rounded-xl"
                        onClick={() => void handleApprove(listing)}
                        disabled={isActionLoading}
                      >
                        <CheckCircle2 className="size-4" />
                        {t("admin.carsPending.approve")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-xl border-border"
                        onClick={() => setRejectTarget(listing)}
                        disabled={isActionLoading}
                      >
                        <XCircle className="size-4" />
                        {t("admin.carsPending.reject")}
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

      <Dialog
        open={!!selectedListing}
        onOpenChange={(open) => {
          if (!open) setSelectedListing(null);
        }}
      >
        {selectedListing && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading">
                <Car className="size-5 text-primary" />
                {selectedListing.year} {selectedListing.make}{" "}
                {selectedListing.model}
              </DialogTitle>
              <DialogDescription>
                {t("admin.carsPending.reviewDescription", {
                  seller:
                    selectedListing.sellerName || selectedListing.sellerId,
                  date: formatDate(selectedListing.createdAt, dateFormatter),
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  icon={Car}
                  label={t("admin.carsPending.makeModel")}
                  value={`${selectedListing.make} ${selectedListing.model}`}
                />
                <DetailRow
                  icon={Calendar}
                  label={t("admin.carsPending.year")}
                  value={selectedListing.year}
                />
                <DetailRow
                  icon={Gauge}
                  label={t("admin.carsPending.mileage")}
                  value={formatMileage(
                    selectedListing.mileage,
                    numberFormatter,
                  )}
                />
                <DetailRow
                  icon={DollarSign}
                  label={t("admin.carsPending.listingPrice")}
                  value={formatPrice(selectedListing.price, currencyFormatter)}
                />
                <DetailRow
                  icon={DollarSign}
                  label={t("admin.carsPending.fairPrice")}
                  value={formatPrice(
                    selectedListing.fairPrice,
                    currencyFormatter,
                  )}
                />
                <DetailRow
                  icon={User}
                  label={t("admin.carsPending.seller")}
                  value={selectedListing.sellerName || "—"}
                />
              </div>

              <Separator />

              <div className="rounded-2xl border border-warning/25 bg-warning/5 p-4">
                <p className="text-sm font-medium text-foreground">
                  {t("admin.carsPending.compactNotice")}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("admin.carsPending.compactNoticeDescription")}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSelectedListing(null)}
                className="border-border"
              >
                {t("admin.carsPending.close")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setRejectTarget(selectedListing)}
                disabled={isActionLoading}
              >
                {t("admin.carsPending.reject")}
              </Button>
              <Button
                onClick={() => void handleApprove(selectedListing)}
                disabled={isActionLoading}
                className="gap-2"
              >
                {isActionLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {t("admin.carsPending.approve")}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.carsPending.rejectTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.carsPending.rejectDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">
              {t("admin.carsPending.rejectReason")}
            </Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder={t("admin.carsPending.rejectReasonPlaceholder")}
              className="min-h-28"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
              className="border-border"
            >
              {t("admin.carsPending.close")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleReject()}
              disabled={isActionLoading}
              className="gap-2"
            >
              {isActionLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {t("admin.carsPending.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CarsPending;
