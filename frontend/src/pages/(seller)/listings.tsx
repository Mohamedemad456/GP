import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  Badge,
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  PaginationBar,
  Skeleton,
  ScrollArea,
} from "@gp/design-system";
import {
  Search,
  Calendar,
  Fuel,
  Gauge,
  Settings2,
  X,
  Car,
  ImageIcon,
  ChevronRight,
  ChevronLeft,
  MapPin,
  TrendingDown,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getApprovedListings,
  getListingById,
  type BuyerListingDto,
  type BuyerListingSpecParams,
  type ListingDetailsDto,
} from "@/lib/listingsApi";
import { useToast } from "@/hooks/use-toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5082";

function resolvePhotoUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${BASE_URL}${url}`;
}

const currencyFmt = new Intl.NumberFormat("en-SA", {
  style: "currency",
  currency: "EGP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function fmtCurrency(val: number | null) {
  if (val == null) return "—";
  return currencyFmt.format(val);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtMileage(km: number) {
  return `${km.toLocaleString()} km`;
}

// ─── Image Gallery ────────────────────────────────────────────────────────────

const ImageGallery = memo(({ photos }: { photos: { photoUrl: string; isPrimary: boolean }[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const urls = photos.map((p) => resolvePhotoUrl(p.photoUrl)).filter(Boolean) as string[];

  if (urls.length === 0) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted">
        <ImageIcon className="size-10 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
        <img
          src={urls[currentIndex]}
          alt={`Photo ${currentIndex + 1}`}
          className="size-full object-cover"
        />
        {urls.length > 1 && (
          <>
            <button
              onClick={() => setCurrentIndex((prev) => (prev === 0 ? urls.length - 1 : prev - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md hover:bg-background transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => (prev === urls.length - 1 ? 0 : prev + 1))}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md hover:bg-background transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
            <span className="absolute bottom-2 right-2 rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground">
              {currentIndex + 1} / {urls.length}
            </span>
          </>
        )}
      </div>
      {urls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {urls.map((url, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`shrink-0 size-16 overflow-hidden rounded-md border-2 transition-colors ${
                i === currentIndex ? "border-primary" : "border-transparent hover:border-muted-foreground/30"
              }`}
            >
              <img src={url} alt={`Thumb ${i + 1}`} className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
ImageGallery.displayName = "ImageGallery";

// ─── Listing Detail Dialog ────────────────────────────────────────────────────

const ListingDetailDialog = memo(
  ({
    listingId,
    open,
    onClose,
  }: {
    listingId: string | null;
    open: boolean;
    onClose: () => void;
  }) => {
    const { t } = useTranslation();
    const [details, setDetails] = useState<ListingDetailsDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { error } = useToast();

    useEffect(() => {
      if (!listingId || !open) return;
      setIsLoading(true);
      setDetails(null);
      getListingById(listingId)
        .then((res) => {
          if (res.success && res.data) setDetails(res.data);
          else error(t("seller.listings.detail.loadError"), { description: res.message });
        })
        .catch(() => error(t("seller.listings.detail.loadError")))
        .finally(() => setIsLoading(false));
    }, [listingId, open, error, t]);

    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {isLoading ? (
                <Skeleton className="h-6 w-48" />
              ) : details ? (
                <>
                  {details.year} {details.makeName} {details.modelName}
                  {details.isGoodDeal && (
                    <Badge variant="success" className="text-[10px]">
                      <TrendingDown className="size-3 me-1" />
                      {t("seller.listings.goodDeal")}
                    </Badge>
                  )}
                </>
              ) : (
                t("seller.listings.detail.title")
              )}
            </DialogTitle>
            <DialogDescription>
              {details?.location ?? t("seller.listings.detail.loading")}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-auto px-6 pb-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              </div>
            ) : details ? (
              <div className="space-y-5">
                {/* Images */}
                <ImageGallery photos={details.photos} />

                <Separator />

                {/* Vehicle details */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("seller.listings.detail.vehicleDetails")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <DetailItem label={t("seller.listings.detail.make")} value={details.makeName} />
                    <DetailItem label={t("seller.listings.detail.model")} value={details.modelName} />
                    <DetailItem label={t("seller.listings.detail.year")} value={details.year.toString()} />
                    <DetailItem label={t("seller.listings.detail.mileage")} value={fmtMileage(details.mileage)} />
                    <DetailItem label={t("seller.listings.detail.fuelType")} value={details.fuelType} />
                    <DetailItem label={t("seller.listings.detail.transmission")} value={details.transmission} />
                    <DetailItem label={t("seller.listings.detail.engineSize")} value={`${details.engineSize}L`} />
                    <DetailItem label={t("seller.listings.detail.color")} value={details.color} />
                    <DetailItem label={t("seller.listings.detail.conditionGrade")} value={details.conditionGrade || "—"} />
                  </div>
                </div>

                <Separator />

                {/* Pricing */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("seller.listings.detail.pricing")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <DetailItem
                      label={t("seller.listings.detail.listingPrice")}
                      value={fmtCurrency(details.listingPrice)}
                      highlight
                    />
                    <DetailItem
                      label={t("seller.listings.goodDeal")}
                      value={details.isGoodDeal ? t("seller.listings.yes") : t("seller.listings.no")}
                    />
                  </div>
                </div>

                {/* Condition checklist */}
                {details.checklistCategories.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t("seller.listings.detail.conditionChecklist")}
                      </h3>
                      {details.checklistCategories.map((cat) => (
                        <div key={cat.categoryName} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                          <p className="text-xs font-semibold text-foreground mb-2">{cat.categoryName}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {cat.defects.map((d) => (
                              <Badge key={d.itemName} variant="secondary" className="text-xs">
                                {d.itemName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Seller contact */}
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("seller.listings.detail.sellerContact")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <DetailItem label={t("seller.listings.detail.sellerName")} value={details.sellerName} />
                    <DetailItem label={t("seller.listings.detail.phone")} value={details.contactPhoneNumber} />
                    {details.whatsAppNumber && (
                      <DetailItem label={t("seller.listings.detail.whatsapp")} value={details.whatsAppNumber} />
                    )}
                    <DetailItem label={t("seller.listings.detail.preferredContact")} value={details.preferredContactMethod} />
                  </div>
                </div>

                <Separator />
                <div className="text-xs text-muted-foreground">
                  {t("seller.listings.detail.listedOn")} {fmtDate(details.createdAt)}
                </div>
              </div>
            ) : null}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  },
);
ListingDetailDialog.displayName = "ListingDetailDialog";

// ─── Detail item helper ───────────────────────────────────────────────────────

function DetailItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-0.5 rounded-lg border border-border/50 bg-muted/20 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

// ─── Listing Card Skeleton ────────────────────────────────────────────────────

const ListingCardSkeleton = () => (
  <Card className="overflow-hidden">
    <Skeleton className="aspect-16/10 w-full" />
    <CardContent className="p-4 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-full" />
    </CardContent>
  </Card>
);

// ─── Listing Card ─────────────────────────────────────────────────────────────

const ListingCard = memo(
  ({
    listing,
    onClick,
  }: {
    listing: BuyerListingDto;
    onClick: () => void;
  }) => {
    const { t } = useTranslation();
    const photoUrl = resolvePhotoUrl(listing.primaryPhotoUrl);

    return (
      <Card
        className="group cursor-pointer overflow-hidden transition-all hover:shadow-md hover:border-primary/30"
        onClick={onClick}
      >
        {/* Image */}
        <div className="relative aspect-16/10 overflow-hidden bg-muted">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`${listing.makeName} ${listing.modelName}`}
              className="size-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageIcon className="size-10 text-muted-foreground/30" />
            </div>
          )}
          {listing.isGoodDeal && (
            <Badge
              variant="success"
              className="absolute top-2 left-2 text-[10px] gap-1"
            >
              <TrendingDown className="size-3" />
              {t("seller.listings.goodDeal")}
            </Badge>
          )}
        </div>

        <CardContent className="p-4">
          {/* Title + Price */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {listing.year} {listing.makeName} {listing.modelName}
              </h3>
            </div>
            <span className="shrink-0 text-sm font-bold text-primary">
              {fmtCurrency(listing.listingPrice)}
            </span>
          </div>

          {/* Specs */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Gauge className="size-3" /> {fmtMileage(listing.mileage)}
            </span>
            <span className="flex items-center gap-1">
              <Fuel className="size-3" /> {listing.fuelType}
            </span>
            <span className="flex items-center gap-1">
              <Settings2 className="size-3" /> {listing.transmission}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3" /> {listing.location}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3" /> {fmtDate(listing.createdAt)}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  },
);
ListingCard.displayName = "ListingCard";

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [6, 12, 18, 24] as const;

const SellerListings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { error } = useToast();

  // Data state
  const [listings, setListings] = useState<BuyerListingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [fuelFilter, setFuelFilter] = useState("all");
  const [transmissionFilter, setTransmissionFilter] = useState("all");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Dialog
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: BuyerListingSpecParams = {
        pageIndex: page,
        pageSize,
        ...(search ? { search } : {}),
        sortDirection: sortDir,
      };
      const response = await getApprovedListings(params);
      if (response.success && response.data) {
        setListings(response.data.data);
        setTotalItems(response.data.count);
      } else {
        error(t("seller.listings.loadError"), { description: response.message });
      }
    } catch {
      error(t("seller.listings.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, sortDir, error, t]);

  useEffect(() => { void fetchListings(); }, [fetchListings]);

  // Client-side fuel / transmission filter (since backend doesn't expose these as filter params)
  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (fuelFilter !== "all" && l.fuelType.toLowerCase() !== fuelFilter) return false;
      if (transmissionFilter !== "all" && l.transmission.toLowerCase() !== transmissionFilter) return false;
      return true;
    });
  }, [listings, fuelFilter, transmissionFilter]);

  const hasActiveFilters = searchInput || fuelFilter !== "all" || transmissionFilter !== "all";

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setFuelFilter("all");
    setTransmissionFilter("all");
    setPage(1);
  }, []);

  const handleOpenDetail = useCallback((id: string) => {
    setSelectedId(id);
    setDialogOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDialogOpen(false);
    setSelectedId(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {t("seller.listings.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("seller.listings.subtitle", { count: totalItems })}
          </p>
        </div>
        <Button onClick={() => navigate("/seller/add-listing")} className="gap-2 shrink-0">
          <Car className="size-4" />
          {t("seller.listings.addNew")}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("seller.listings.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Fuel Type */}
            <Select value={fuelFilter} onValueChange={setFuelFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("seller.listings.filters.fuelType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("seller.listings.filters.allFuel")}</SelectItem>
                <SelectItem value="gasoline">{t("seller.listings.filters.gasoline")}</SelectItem>
                <SelectItem value="diesel">{t("seller.listings.filters.diesel")}</SelectItem>
                <SelectItem value="hybrid">{t("seller.listings.filters.hybrid")}</SelectItem>
                <SelectItem value="electric">{t("seller.listings.filters.electric")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Transmission */}
            <Select value={transmissionFilter} onValueChange={setTransmissionFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("seller.listings.filters.transmission")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("seller.listings.filters.allTransmission")}</SelectItem>
                <SelectItem value="automatic">{t("seller.listings.filters.automatic")}</SelectItem>
                <SelectItem value="manual">{t("seller.listings.filters.manual")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortDir} onValueChange={(v) => { setSortDir(v as "asc" | "desc"); setPage(1); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">{t("seller.listings.sort.newest")}</SelectItem>
                <SelectItem value="asc">{t("seller.listings.sort.oldest")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Footer row */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Label className="text-xs">{t("seller.listings.showing")}:</Label>
              <span className="font-medium text-foreground">{filtered.length}</span>
              {totalItems !== filtered.length && (
                <span>/ {totalItems}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void fetchListings()}
                className="gap-1.5 text-xs text-muted-foreground"
                disabled={isLoading}
              >
                <RefreshCw className={`size-3 ${isLoading ? "animate-spin" : ""}`} />
                {t("seller.listings.refresh")}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="gap-1.5 text-xs text-muted-foreground"
                >
                  <X className="size-3" />
                  {t("seller.listings.clearFilters")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: pageSize }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Car className="size-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {t("seller.listings.empty.title")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("seller.listings.empty.subtitle")}
            </p>
            <Button className="mt-4 gap-2" onClick={() => navigate("/seller/add-listing")}>
              <Car className="size-4" />
              {t("seller.listings.addNew")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onClick={() => handleOpenDetail(listing.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 space-y-3">
              <div className="text-[11px] text-muted-foreground/90">
                {t(
                  "seller.listings.paginationSummary",
                  "Showing {{from}}–{{to}} of {{total}} listings",
                  {
                    from: totalItems === 0 ? 0 : (page - 1) * pageSize + 1,
                    to: Math.min(totalItems, page * pageSize),
                    total: totalItems,
                  },
                )}
              </div>
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
                rowsPerPageLabel={t("admin.common.rowsPerPage")}
                dir="ltr"
                className="rounded-xl border border-border/70 bg-card/80 shadow-sm"
              />
            </div>
          )}
        </>
      )}

      {/* Detail Dialog */}
      <ListingDetailDialog
        listingId={selectedId}
        open={dialogOpen}
        onClose={handleCloseDetail}
      />
    </div>
  );
};

export default SellerListings;
