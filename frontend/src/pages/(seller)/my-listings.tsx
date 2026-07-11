import { useCallback, useEffect, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ImageIcon, Edit2, Trash2, RefreshCw, ArrowUpDown, CheckCircle2, XCircle, AlertCircle, TrendingUp } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  Badge,
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
  Skeleton,
  Separator,
  ScrollArea,
  PaginationBar,
  ImageCarousel,
} from "@gp/design-system";
import { useToast } from "@/hooks/use-toast";

import type {
  MyListingDto,
  MyListingSpecParams,
  MyListingDetailsDto,
} from "@/lib/listingsApi";
import {
  getMyListings,
  getMyListingDetails,
  deleteListing,
} from "@/lib/listingsApi";
import { getActiveMakes } from "@/lib/makesApi";
import { getActiveModels } from "@/lib/modelsApi";
import { MLMetadataCard } from "@/components/seller/MLMetadataCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField = "price" | "year" | "mileage" | "createdAt" | "updatedAt";
type SortDirection = "asc" | "desc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5082";

function resolvePhotoUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  // Ensure proper URL concatenation with leading slash
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${BASE_URL}${path}`;
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

const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  Active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Sold: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Archived: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

// SORT_FIELD_OPTIONS and SORT_DIR_OPTIONS are defined inside the component
// so they can use the t() hook for translations.

// ─── Listing Detail Modal ─────────────────────────────────────────────────────

const ListingDetailModal = memo(
  ({
    listingId,
    open,
    onClose,
    onEdit,
    onDelete,
  }: {
    listingId: string | null;
    open: boolean;
    onClose: () => void;
    onEdit: (id: string) => void;
    onDelete: (id: string) => Promise<void>;
  }) => {
    const { t } = useTranslation();
    const { error } = useToast();
    const [listing, setListing] = useState<MyListingDetailsDto | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Fetch seller-owned listing details when modal opens
    useEffect(() => {
      if (!listingId || !open) {
        setListing(null);
        return;
      }

      setIsLoadingDetails(true);
      getMyListingDetails(listingId)
        .then((res) => {
          if (res.success && res.data) {
            setListing(res.data);
          } else {
            error("Failed to load listing details", {
              description: res.message,
            });
          }
        })
        .catch(() => {
          error("Failed to load listing details");
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    }, [listingId, open, error]);

    const handleDelete = async () => {
      if (!listingId) return;
      setIsDeleting(true);
      try {
        await onDelete(listingId);
      } finally {
        setIsDeleting(false);
      }
    };

    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 sm:px-6 pt-5 pb-3 shrink-0 border-b border-border/60">
            <DialogTitle className="pr-8">
              {isLoadingDetails ? (
                <Skeleton className="h-6 w-48 sm:w-64" />
              ) : listing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">
                    {listing.year} {listing.makeName} {listing.modelName}
                  </span>
                  <Badge className={statusColors[listing.status] || statusColors.Draft}>
                    {listing.status}
                  </Badge>
                </div>
              ) : (
                t("Loading", "Loading...")
              )}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 text-xs">
              {isLoadingDetails ? (
                <Skeleton className="h-4 w-32 mt-1" />
              ) : (
                listing && listing.locationName
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-auto">
            <div className="px-4 sm:px-6 pb-4">
            {isLoadingDetails ? (
              <div className="space-y-4 py-4">
                <Skeleton className="aspect-video w-full rounded-xl" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              </div>
            ) : listing ? (
              <div className="space-y-4 pt-4">
                {/* Photo Carousel */}
                <div className="-mx-4 sm:-mx-6">
                  {listing.photos.length > 0 ? (
                    <ImageCarousel
                      images={listing.photos
                        .slice()
                        .sort((a, b) => a.displayOrder - b.displayOrder)
                        .map((p) => resolvePhotoUrl(p.photoUrl))
                        .filter((url): url is string => url !== null)}
                      altBase={`${listing.makeName} ${listing.modelName}`}
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-muted">
                      <ImageIcon className="size-12 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                <Separator />

                {/* Rejection Banner */}
                {listing.status === "Rejected" && listing.rejectionReason && (
                  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                    <div>
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300">{t("seller.listings.detail.rejectionReason") || "Rejection Reason"}</p>
                      <p className="text-sm text-red-600 dark:text-red-400">{listing.rejectionReason}</p>
                    </div>
                  </div>
                )}

                {/* Listing Progress */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{t("seller.listings.detail.listingProgress") || "Listing Progress"}</h3>
                    <span className="text-sm font-bold text-primary">{listing.progress.completionPercentage}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${listing.progress.completionPercentage}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 xs:grid-cols-4">
                    <ProgressStep label={t("seller.listings.detail.basicInfo") || "Basic Info"} done={listing.progress.hasBasicInfo} />
                    <ProgressStep label={t("seller.listings.detail.photos") || "Photos"} done={listing.progress.hasPhotos} />
                    <ProgressStep label={t("seller.listings.detail.condition") || "Condition"} done={listing.progress.hasConditionChecklist} />
                    <ProgressStep label={t("seller.listings.detail.mlPricing") || "ML Pricing"} done={listing.progress.hasMLPricing} />
                  </div>
                </div>

                <Separator />

                {/* Vehicle Information */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{t("seller.listings.detail.vehicleDetails") || "Vehicle Details"}</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <DetailItem label={t("seller.listings.detail.make") || "Make"} value={listing.makeName} />
                    <DetailItem label={t("seller.listings.detail.model") || "Model"} value={listing.modelName} />
                    <DetailItem label={t("seller.listings.detail.year") || "Year"} value={listing.year.toString()} />
                    <DetailItem label={t("seller.listings.detail.mileage") || "Mileage"} value={`${listing.mileage.toLocaleString()} km`} />
                    <DetailItem label={t("seller.listings.detail.fuelType") || "Fuel Type"} value={listing.fuelType} />
                    <DetailItem label={t("seller.listings.detail.transmission") || "Transmission"} value={listing.transmission} />
                    <DetailItem label={t("seller.listings.detail.engineSize") || "Engine Size"} value={`${listing.engineSize}L`} />
                    <DetailItem label={t("seller.listings.detail.color") || "Color"} value={listing.color} />
                    <DetailItem label={t("seller.listings.detail.conditionGrade") || "Condition Grade"} value={listing.conditionGrade || "—"} />
                  </div>
                </div>

                <Separator />

                {listing.fairPrice != null && (
                  <>
                    <MLMetadataCard 
                      metadata={{
                        fairPrice: listing.fairPrice,
                        negotiationRangeLower: listing.negotiationRangeLower,
                        negotiationRangeUpper: listing.negotiationRangeUpper,
                        confidenceLevel: listing.confidenceLevel,
                        modelVersion: listing.modelVersion,
                        predictedAt: listing.predictedAt
                      }}
                      currentPrice={listing.listingPrice ?? 0}
                    />
                    <Separator />
                  </>
                )}

                {/* Pricing */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{t("seller.listings.detail.pricing") || "Pricing"}</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <DetailItem
                      label={t("seller.listings.detail.listingPrice") || "Listing Price"}
                      value={fmtCurrency(listing.listingPrice)}
                      highlight={listing.listingPrice !== null}
                    />
                    {listing.fairPrice != null && (
                      <DetailItem
                        label={t("seller.listings.detail.aiFairPrice") || "AI Fair Price"}
                        value={fmtCurrency(listing.fairPrice)}
                        highlight
                      />
                    )}
                    {listing.negotiationRangeLower != null && listing.negotiationRangeUpper != null && (
                      <DetailItem
                        label={t("seller.listings.detail.negotiationRange") || "Negotiation Range"}
                        value={`${fmtCurrency(listing.negotiationRangeLower)} – ${fmtCurrency(listing.negotiationRangeUpper)}`}
                      />
                    )}
                    {listing.predictedAt && (
                      <DetailItem label={t("seller.listings.detail.predictedAt") || "Predicted At"} value={fmtDate(listing.predictedAt)} />
                    )}
                  </div>
                  {listing.fairPrice != null && (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                      <TrendingUp className="size-4 shrink-0 text-primary" />
                      <p className="text-xs text-muted-foreground">
                        {t("seller.listings.detail.aiPricingNote") || "AI pricing powered by the KARNA ML model"}{listing.modelVersion ? ` (${listing.modelVersion})` : ""}.
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Dates */}
                {/* Dates */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{t("seller.listings.detail.listingDetails") || "Listing Details"}</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <DetailItem label={t("seller.listings.detail.createdAt") || "Created"} value={fmtDate(listing.createdAt)} />
                    {listing.updatedAt && (
                      <DetailItem label={t("seller.listings.detail.updatedAt") || "Last Updated"} value={fmtDate(listing.updatedAt)} />
                    )}
                    <DetailItem label={t("seller.listings.detail.location") || "Location"} value={listing.locationName} />
                  </div>
                </div>

                <Separator />

                {/* Description */}
                {listing.description && (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">{t("seller.listings.detail.description") || "Description"}</h3>
                      <p className="text-sm text-muted-foreground">{listing.description}</p>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Contact Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{t("seller.listings.detail.contactInfo") || "Contact Information"}</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <DetailItem label={t("seller.listings.detail.phone") || "Phone"} value={listing.contactPhoneNumber} />
                    {listing.whatsAppNumber && (
                      <DetailItem label={t("seller.listings.detail.whatsapp") || "WhatsApp"} value={listing.whatsAppNumber} />
                    )}
                    <DetailItem label={t("seller.listings.detail.preferredMethod") || "Preferred Method"} value={listing.preferredContactMethod} />
                  </div>
                </div>

                {/* Condition Checklist */}
                {listing.checklistCategories.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">{t("seller.listings.detail.conditionChecklist") || "Condition Checklist"}</h3>
                      <div className="space-y-3">
                        {listing.checklistCategories.map((cat) => (
                          <div key={cat.categoryId} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                            <p className="mb-2 text-xs font-semibold text-foreground">{cat.categoryName}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {cat.selectedItems.map((item) => (
                                <span
                                  key={item.id}
                                  className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive"
                                >
                                  <XCircle className="size-3" />
                                  {item.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

              </div>
            ) : null}
            </div>
          </ScrollArea>

          {/* Sticky action footer */}
          {listing && !isLoadingDetails && (
            <div className="shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-sm px-4 sm:px-6 py-3 flex flex-col-reverse sm:flex-row gap-2 sm:justify-between">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="gap-1.5 w-full sm:w-auto"
              >
                <Trash2 className="size-4" />
                {isDeleting ? t("Deleting", "Deleting...") : t("seller.listings.detail.delete", "Delete")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(listing.id)}
                className="gap-1.5 w-full sm:w-auto"
              >
                <Edit2 className="size-4" />
                {t("seller.listings.detail.edit", "Edit")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  },
);
ListingDetailModal.displayName = "ListingDetailModal";

// ─── Progress Step Helper ─────────────────────────────────────────────────────

function ProgressStep({ label, done }: { label: string; done: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${done
          ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
          : "border-border/50 bg-muted/20 text-muted-foreground"
        }`}
    >
      {done ? (
        <CheckCircle2 className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
      ) : (
        <XCircle className="size-3.5 shrink-0" />
      )}
      {label}
    </div>
  );
}

// ─── Detail Item Helper ────────────────────────────────────────────────────────

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
      <p
        className={`text-sm font-medium ${highlight ? "text-primary" : "text-foreground"}`}
      >
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

const MyListingCard = memo(
  ({ listing, onClick }: { listing: MyListingDto; onClick: () => void }) => {
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
          <Badge
            className={`absolute top-2 left-2 text-[10px] ${statusColors[listing.status] || statusColors.Draft}`}
          >
            {listing.status}
          </Badge>
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

          {/* Additional Info */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("seller.myListings.card.completion", "Completion")}</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${listing.completionPercentage}%` }}
                  />
                </div>
                <span className="font-medium text-foreground">
                  {listing.completionPercentage}%
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {t("seller.myListings.card.lastUpdated", "Last updated")}: {fmtDate(listing.updatedAt || listing.createdAt)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
);
MyListingCard.displayName = "MyListingCard";

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [6, 12, 18, 24] as const;

const SellerMyListings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { error, success } = useToast();

  // Data state
  const [listings, setListings] = useState<MyListingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [makeFilter, setMakeFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  // Data for filters
  const [makes, setMakes] = useState<Array<{ id: string; name: string }>>([]);
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Modal
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Load makes on mount
  useEffect(() => {
    getActiveMakes()
      .then((res: any) => {
        if (res.success && res.data) {
          setMakes(res.data.data.map((m: any) => ({ id: m.id, name: m.name })));
        }
      })
      .catch(() => {
        // Silent fail
      });
  }, []);

  // Load models when make changes
  useEffect(() => {
    if (makeFilter !== "all") {
      getActiveModels()
        .then((res: any) => {
          if (res.success && res.data) {
            // Filter models by selected make
            const filtered = res.data.filter(
              (m: any) => m.makeId === makeFilter,
            );
            setModels(filtered.map((m: any) => ({ id: m.id, name: m.name })));
          }
        })
        .catch(() => {
          setModels([]);
        });
    } else {
      setModels([]);
    }
    setModelFilter("all");
  }, [makeFilter]);

  // Fetch listings
  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: MyListingSpecParams = {
        pageIndex: page,
        pageSize,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(makeFilter !== "all" ? { makeId: makeFilter } : {}),
        ...(modelFilter !== "all" ? { modelId: modelFilter } : {}),
        sort: sortBy,
        sortDirection: sortDir,
      };
      const response = await getMyListings(params);
      if (response.success && response.data) {
        setListings(response.data.data);
        setTotalItems(response.data.count);
      } else {
        error(t("seller.myListings.loadError") || "Failed to load listings", {
          description: response.message,
        });
      }
    } catch {
      error(t("seller.myListings.loadError") || "Failed to load listings");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, statusFilter, makeFilter, modelFilter, sortBy, sortDir, error, t]);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  const hasActiveFilters =
    statusFilter !== "all" || makeFilter !== "all" || modelFilter !== "all";

  const clearFilters = useCallback(() => {
    setStatusFilter("all");
    setMakeFilter("all");
    setModelFilter("all");
    setPage(1);
  }, []);

  const handleOpenDetail = useCallback((listing: MyListingDto) => {
    setSelectedListingId(listing.id);
    setModalOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setModalOpen(false);
    setSelectedListingId(null);
  }, []);

  const handleEdit = (id: string) => {
    handleCloseDetail();
    navigate(`/seller/edit-listing/${id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await deleteListing(id);
      if (result.success) {
        success("Listing deleted successfully");
        handleCloseDetail();
        await fetchListings();
      } else {
        error("Failed to delete listing", { description: result.message });
      }
    } catch {
      error("Failed to delete listing");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {t("seller.myListings.title") || "My Listings"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("seller.myListings.subtitle", { count: totalItems }) ||
              `You have ${totalItems} listings`}
          </p>
        </div>
        <Button
          onClick={() => navigate("/seller/add-listing")}
          className="gap-2 shrink-0"
        >
          + {t("seller.myListings.newListing", "New Listing")}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("seller.myListings.filter.allStatuses", "All Statuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("seller.myListings.filter.allStatuses", "All Statuses")}</SelectItem>
                <SelectItem value="Draft">{t("seller.myListings.filter.draft", "Draft")}</SelectItem>
                <SelectItem value="Pending">{t("seller.myListings.filter.pending", "Pending")}</SelectItem>
                <SelectItem value="Active">{t("seller.myListings.filter.active", "Active")}</SelectItem>
                <SelectItem value="Rejected">{t("seller.myListings.filter.rejected", "Rejected")}</SelectItem>
                <SelectItem value="Sold">{t("seller.myListings.filter.sold", "Sold")}</SelectItem>
                <SelectItem value="Archived">{t("seller.myListings.filter.archived", "Archived")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Make Filter */}
            <Select
              value={makeFilter}
              onValueChange={(v) => {
                setMakeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("seller.myListings.filter.allMakes", "All Makes")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("seller.myListings.filter.allMakes", "All Makes")}</SelectItem>
                {makes.map((make) => (
                  <SelectItem key={make.id} value={make.id}>
                    {make.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Model Filter */}
            <Select
              value={modelFilter}
              onValueChange={(v) => {
                setModelFilter(v);
                setPage(1);
              }}
              disabled={makeFilter === "all"}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("seller.myListings.filter.allModels", "All Models")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("seller.myListings.filter.allModels", "All Models")}</SelectItem>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchListings()}
              disabled={isLoading}
              className="gap-1.5"
            >
              <RefreshCw
                className={`size-4 ${isLoading ? "animate-spin" : ""}`}
              />
              {t("seller.myListings.filter.refresh", "Refresh")}
            </Button>
          </div>

          {/* Sorting Row */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Sort By */}
            <Select
              value={sortBy}
              onValueChange={(v) => {
                setSortBy(v as SortField);
                setPage(1);
              }}
            >
              <SelectTrigger className="gap-1.5">
                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                <SelectValue placeholder={t("seller.myListings.sort.sortBy", "Sort by")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">{t("seller.myListings.sort.dateCreated", "Date Created")}</SelectItem>
                <SelectItem value="updatedAt">{t("seller.myListings.sort.lastUpdated", "Last Updated")}</SelectItem>
                <SelectItem value="price">{t("seller.myListings.sort.price", "Price")}</SelectItem>
                <SelectItem value="year">{t("seller.myListings.sort.year", "Year")}</SelectItem>
                <SelectItem value="mileage">{t("seller.myListings.sort.mileage", "Mileage")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Direction */}
            <Select
              value={sortDir}
              onValueChange={(v) => {
                setSortDir(v as SortDirection);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("seller.myListings.sort.direction", "Direction")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">{t("seller.myListings.sort.descending", "Descending")}</SelectItem>
                <SelectItem value="asc">{t("seller.myListings.sort.ascending", "Ascending")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Footer Actions */}
          {hasActiveFilters && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t("seller.myListings.filter.filteredResults", "Showing filtered results")}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs"
              >
                {t("seller.myListings.filter.clearFilters", "Clear Filters")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: pageSize }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ImageIcon className="size-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {t("seller.myListings.empty.title") || "No Listings Yet"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("seller.myListings.empty.subtitle") ||
                "Create your first listing to get started"}
            </p>
            <Button
              className="mt-4 gap-2"
              onClick={() => navigate("/seller/add-listing")}
            >
              + {t("seller.myListings.newListing", "New Listing")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => (
              <MyListingCard
                key={listing.id}
                listing={listing}
                onClick={() => handleOpenDetail(listing)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 space-y-3">
              <div className="text-[11px] text-muted-foreground/90">
                Showing {totalItems === 0 ? 0 : (page - 1) * pageSize + 1}–
                {Math.min(totalItems, page * pageSize)} of {totalItems} listings
              </div>
              <PaginationBar
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageSizeChange={(size: typeof pageSize) => {
                  setPage(1);
                  setPageSize(size);
                }}
                totalItems={totalItems}
                rowsPerPageLabel="Listings per page"
                dir="ltr"
                className="rounded-xl border border-border/70 bg-card/80 shadow-sm"
              />
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      <ListingDetailModal
        listingId={selectedListingId}
        open={modalOpen}
        onClose={handleCloseDetail}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default SellerMyListings;