import { useCallback, useEffect, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ImageIcon, Edit2, Trash2, RefreshCw, ArrowUpDown } from "lucide-react";

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
} from "@gp/design-system";
import { useToast } from "@/hooks/use-toast";

import type {
  MyListingDto,
  MyListingSpecParams,
  ListingDetailsDto,
} from "@/lib/listingsApi";
import {
  getMyListings,
  getListingById,
  deleteListing,
} from "@/lib/listingsApi";
import { getActiveMakes } from "@/lib/makesApi";
import { getActiveModels } from "@/lib/modelsApi";

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

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: "createdAt", label: "Date Created" },
  { value: "updatedAt", label: "Last Updated" },
  { value: "price", label: "Price" },
  { value: "year", label: "Year" },
  { value: "mileage", label: "Mileage" },
];

const SORT_DIR_OPTIONS: { value: SortDirection; label: string }[] = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
];

// ─── Image Gallery ────────────────────────────────────────────────────────────

const ImageGallery = memo(({ photoUrl }: { photoUrl: string | null }) => {
  const url = resolvePhotoUrl(photoUrl);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
      {url ? (
        <img src={url} alt="Listing photo" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <ImageIcon className="size-10 text-muted-foreground/30" />
        </div>
      )}
    </div>
  );
});
ImageGallery.displayName = "ImageGallery";

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
    const { error } = useToast();
    const [listing, setListing] = useState<ListingDetailsDto | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Fetch listing details when modal opens
    useEffect(() => {
      if (!listingId || !open) {
        setListing(null);
        return;
      }

      setIsLoadingDetails(true);
      getListingById(listingId)
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
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle>
              {isLoadingDetails ? (
                <Skeleton className="h-6 w-64" />
              ) : listing ? (
                <div className="flex items-center justify-between gap-4">
                  <span>
                    {listing.year} {listing.makeName} {listing.modelName}
                  </span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Active
                  </Badge>
                </div>
              ) : (
                "Loading..."
              )}
            </DialogTitle>
            <DialogDescription>
              {isLoadingDetails ? (
                <Skeleton className="h-4 w-40 mt-1" />
              ) : (
                listing && `${listing.location}`
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-auto px-6 pb-6">
            {isLoadingDetails ? (
              <div className="space-y-4 p-3">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              </div>
            ) : listing ? (
              <div className="space-y-5 p-3">
                {/* Image */}
                <ImageGallery photoUrl={listing.photos[0]?.photoUrl || null} />

                <Separator />

                {/* Details */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Vehicle Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <DetailItem label="Make" value={listing.makeName} />
                    <DetailItem label="Model" value={listing.modelName} />
                    <DetailItem label="Year" value={listing.year.toString()} />
                    <DetailItem
                      label="Mileage"
                      value={`${listing.mileage.toLocaleString()} km`}
                    />
                    <DetailItem label="Fuel Type" value={listing.fuelType} />
                    <DetailItem
                      label="Transmission"
                      value={listing.transmission}
                    />
                    <DetailItem
                      label="Engine Size"
                      value={`${listing.engineSize}L`}
                    />
                    <DetailItem label="Color" value={listing.color} />
                    <DetailItem
                      label="Condition"
                      value={listing.conditionGrade || "—"}
                    />
                  </div>
                </div>

                <Separator />

                {/* Pricing & Status */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Listing Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailItem
                      label="Price"
                      value={fmtCurrency(listing.listingPrice)}
                      highlight={listing.listingPrice !== null}
                    />
                  </div>
                </div>

                <Separator />

                {/* Description */}
                {listing.description && (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">
                        Description
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {listing.description}
                      </p>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Seller Contact */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Seller Contact
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailItem label="Name" value={listing.sellerName} />
                    <DetailItem
                      label="Phone"
                      value={listing.contactPhoneNumber}
                    />
                    {listing.whatsAppNumber && (
                      <DetailItem
                        label="WhatsApp"
                        value={listing.whatsAppNumber}
                      />
                    )}
                    <DetailItem
                      label="Preferred Method"
                      value={listing.preferredContactMethod}
                    />
                  </div>
                </div>

                <Separator />

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(listing.id)}
                    className="gap-1.5"
                  >
                    <Edit2 className="size-4" />
                    Edit
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="gap-1.5"
                  >
                    <Trash2 className="size-4" />
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            ) : null}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  },
);
ListingDetailModal.displayName = "ListingDetailModal";

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
              <span className="text-muted-foreground">Completion</span>
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
              Last updated: {fmtDate(listing.updatedAt || listing.createdAt)}
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
          + New Listing
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
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Sold">Sold</SelectItem>
                <SelectItem value="Archived">Archived</SelectItem>
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
                <SelectValue placeholder="All Makes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Makes</SelectItem>
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
                <SelectValue placeholder="All Models" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Models</SelectItem>
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
              Refresh
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
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_FIELD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
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
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                {SORT_DIR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Footer Actions */}
          {hasActiveFilters && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing filtered results
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs"
              >
                Clear Filters
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
              + New Listing
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