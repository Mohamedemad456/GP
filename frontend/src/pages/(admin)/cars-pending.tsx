import { useMemo, useState, useCallback } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Separator,
  PaginationBar,
} from "@gp/design-system";
import {
  Eye,
  Heart,
  Calendar,
  Fuel,
  Gauge,
  Cog,
  Palette,
  DollarSign,
  X,
  ZoomIn,
  Car,
  User,
  FileText,
  Clock,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CarListing {
  id: string;
  sellerId: string;
  sellerName: string;
  makeId: number;
  makeName: string;
  modelId: number;
  modelName: string;
  year: number;
  mileage: number;
  fuelType: string;
  transmission: string;
  engineSize: string;
  color: string;
  description: string;
  basePrice: number;
  totalDeductionPercentage: number;
  suggestedPrice: number;
  listingPrice: number;
  conditionGrade: string;
  status: string;
  rejectionReason: string | null;
  approvedByAdminId: string | null;
  viewCount: number;
  favoriteCount: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  soldAt: string | null;
  images: string[];
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_CARS: CarListing[] = [
  {
    id: "lst-001",
    sellerId: "usr-101",
    sellerName: "Ahmed Al-Fahd",
    makeId: 1,
    makeName: "Toyota",
    modelId: 10,
    modelName: "Camry",
    year: 2024,
    mileage: 12500,
    fuelType: "Gasoline",
    transmission: "Automatic",
    engineSize: "2.5L",
    color: "Pearl White",
    description:
      "Excellent condition 2024 Toyota Camry with full service history. Single owner, no accidents. Comes with premium package including leather seats, sunroof, and advanced safety features.",
    basePrice: 95000,
    totalDeductionPercentage: 5,
    suggestedPrice: 90250,
    listingPrice: 89000,
    conditionGrade: "A",
    status: "pending",
    rejectionReason: null,
    approvedByAdminId: null,
    viewCount: 45,
    favoriteCount: 12,
    createdAt: "2025-02-01T10:30:00Z",
    updatedAt: "2025-02-01T10:30:00Z",
    approvedAt: null,
    soldAt: null,
    images: [
      "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1606611013016-969c19ba27d5?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&h=600&fit=crop",
    ],
  },
  {
    id: "lst-002",
    sellerId: "usr-102",
    sellerName: "Sara Hassan",
    makeId: 2,
    makeName: "Honda",
    modelId: 20,
    modelName: "Accord",
    year: 2023,
    mileage: 28000,
    fuelType: "Hybrid",
    transmission: "CVT",
    engineSize: "2.0L",
    color: "Lunar Silver",
    description:
      "2023 Honda Accord Hybrid in lunar silver. Great fuel economy with hybrid technology. Well maintained with all service records available. Features include Honda Sensing suite and wireless Apple CarPlay.",
    basePrice: 82000,
    totalDeductionPercentage: 8,
    suggestedPrice: 75440,
    listingPrice: 76000,
    conditionGrade: "A-",
    status: "pending",
    rejectionReason: null,
    approvedByAdminId: null,
    viewCount: 32,
    favoriteCount: 8,
    createdAt: "2025-02-02T14:15:00Z",
    updatedAt: "2025-02-02T14:15:00Z",
    approvedAt: null,
    soldAt: null,
    images: [
      "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&h=600&fit=crop",
    ],
  },
  {
    id: "lst-003",
    sellerId: "usr-103",
    sellerName: "Mohammed Qasim",
    makeId: 3,
    makeName: "BMW",
    modelId: 30,
    modelName: "330i",
    year: 2022,
    mileage: 41000,
    fuelType: "Gasoline",
    transmission: "Automatic",
    engineSize: "2.0L Turbo",
    color: "Alpine White",
    description:
      "BMW 330i M Sport package with premium navigation, Harman Kardon audio, and heated seats. Minor cosmetic wear on the front bumper. Full dealer service history.",
    basePrice: 120000,
    totalDeductionPercentage: 12,
    suggestedPrice: 105600,
    listingPrice: 108000,
    conditionGrade: "B+",
    status: "pending",
    rejectionReason: null,
    approvedByAdminId: null,
    viewCount: 78,
    favoriteCount: 23,
    createdAt: "2025-02-03T09:45:00Z",
    updatedAt: "2025-02-03T09:45:00Z",
    approvedAt: null,
    soldAt: null,
    images: [
      "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1520050206757-06e0afe21e56?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop",
    ],
  },
  {
    id: "lst-004",
    sellerId: "usr-104",
    sellerName: "Fatima Al-Rashid",
    makeId: 4,
    makeName: "Mercedes-Benz",
    modelId: 40,
    modelName: "C200",
    year: 2023,
    mileage: 19500,
    fuelType: "Gasoline",
    transmission: "9G-Tronic",
    engineSize: "1.5L Turbo",
    color: "Obsidian Black",
    description:
      "Stunning 2023 Mercedes-Benz C200 AMG Line with full options. Includes MBUX infotainment, 360-degree camera, ambient lighting, and Burmester sound system. Garage kept, immaculate condition.",
    basePrice: 145000,
    totalDeductionPercentage: 6,
    suggestedPrice: 136300,
    listingPrice: 138000,
    conditionGrade: "A+",
    status: "pending",
    rejectionReason: null,
    approvedByAdminId: null,
    viewCount: 112,
    favoriteCount: 34,
    createdAt: "2025-02-04T16:20:00Z",
    updatedAt: "2025-02-04T16:20:00Z",
    approvedAt: null,
    soldAt: null,
    images: [
      "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&h=600&fit=crop",
    ],
  },
  {
    id: "lst-005",
    sellerId: "usr-105",
    sellerName: "Khalid Nasser",
    makeId: 5,
    makeName: "Nissan",
    modelId: 50,
    modelName: "Patrol",
    year: 2024,
    mileage: 8200,
    fuelType: "Gasoline",
    transmission: "7-Speed Automatic",
    engineSize: "5.6L V8",
    color: "Desert Sand",
    description:
      "Brand-new condition 2024 Nissan Patrol V8 Platinum. Full option with hydraulic body motion control, premium leather, and rear entertainment. Perfect for desert and city driving.",
    basePrice: 260000,
    totalDeductionPercentage: 3,
    suggestedPrice: 252200,
    listingPrice: 255000,
    conditionGrade: "A+",
    status: "pending",
    rejectionReason: null,
    approvedByAdminId: null,
    viewCount: 156,
    favoriteCount: 41,
    createdAt: "2025-02-05T11:00:00Z",
    updatedAt: "2025-02-05T11:00:00Z",
    approvedAt: null,
    soldAt: null,
    images: [
      "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=800&h=600&fit=crop",
    ],
  }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMileage(km: number) {
  return new Intl.NumberFormat("en-US").format(km) + " km";
}

function gradeVariant(grade: string) {
  if (grade.startsWith("A")) return "success" as const;
  if (grade.startsWith("B")) return "info" as const;
  if (grade.startsWith("C")) return "warning" as const;
  return "secondary" as const;
}

// ─── Image Lightbox ──────────────────────────────────────────────────────────

function ImageLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-110 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
      >
        <X className="size-6" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 z-110 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Previous */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-4 z-110 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}

      {/* Image */}
      <img
        src={images[currentIndex]}
        alt={`Car image ${currentIndex + 1}`}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-4 z-110 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
        >
          <ChevronRight className="size-6" />
        </button>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 z-110 flex -translate-x-1/2 gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(i);
              }}
              className={`h-14 w-20 overflow-hidden rounded-md border-2 transition-all ${
                i === currentIndex
                  ? "border-white opacity-100 scale-105"
                  : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <img
                src={img}
                alt={`Thumbnail ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Detail Row ──────────────────────────────────────────────────────────────

function DetailRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 ${className ?? ""}`}>
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ─── Listing Details Dialog ──────────────────────────────────────────────────

function ListingDetailsDialog({
  car,
  open,
  onOpenChange,
}: {
  car: CarListing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { t } = useTranslation();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <Car className="size-5 text-primary" />
              {car.year} {car.makeName} {car.modelName}
            </DialogTitle>
            <DialogDescription>
              Listing #{car.id} &middot; Posted by {car.sellerName} on{" "}
              {formatDate(car.createdAt)}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto -mx-6 px-6 space-y-5">
            {/* ── Image Gallery ── */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.carsPending.photos")} ({car.images.length})
              </p>
              <div className="grid grid-cols-4 gap-2">
                {car.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxIndex(i)}
                    className="group relative aspect-4/3 overflow-hidden rounded-lg border border-border bg-muted transition-all hover:ring-2 hover:ring-primary/50"
                  >
                    <img
                      src={img}
                      alt={`${car.makeName} ${car.modelName} - Photo ${i + 1}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                      <ZoomIn className="size-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* ── Vehicle Details ── */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.carsPending.vehicleDetails")}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <DetailRow icon={Car} label={t("admin.carsPending.makeModel")} value={`${car.makeName} ${car.modelName}`} />
                <DetailRow icon={Calendar} label={t("admin.carsPending.year")} value={car.year} />
                <DetailRow icon={Gauge} label={t("admin.carsPending.mileage")} value={formatMileage(car.mileage)} />
                <DetailRow icon={Fuel} label={t("admin.carsPending.fuelType")} value={car.fuelType} />
                <DetailRow icon={Cog} label={t("admin.carsPending.transmission")} value={car.transmission} />
                <DetailRow icon={Cog} label={t("admin.carsPending.engineSize")} value={car.engineSize} />
                <DetailRow icon={Palette} label={t("admin.carsPending.color")} value={car.color} />
                <DetailRow
                  icon={Car}
                  label={t("admin.carsPending.conditionGrade")}
                  value={
                    <Badge variant={gradeVariant(car.conditionGrade)}>
                      {car.conditionGrade}
                    </Badge>
                  }
                />
              </div>
            </div>

            <Separator />

            {/* ── Pricing ── */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.carsPending.pricing")}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <DetailRow icon={DollarSign} label={t("admin.carsPending.basePrice")} value={formatPrice(car.basePrice)} />
                <DetailRow
                  icon={DollarSign}
                  label={t("admin.carsPending.deduction")}
                  value={`${car.totalDeductionPercentage}%`}
                />
                <DetailRow
                  icon={DollarSign}
                  label={t("admin.carsPending.suggestedPrice")}
                  value={formatPrice(car.suggestedPrice)}
                />
                <DetailRow
                  icon={DollarSign}
                  label={t("admin.carsPending.listingPrice")}
                  value={
                    <span className="text-base font-bold text-primary">
                      {formatPrice(car.listingPrice)}
                    </span>
                  }
                />
              </div>
            </div>

            <Separator />

            {/* ── Description ── */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.carsPending.description")}
              </p>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm leading-relaxed text-foreground">
                    {car.description}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Seller & Stats ── */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.carsPending.sellerEngagement")}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <DetailRow icon={User} label={t("admin.carsPending.seller")} value={car.sellerName} />
                <DetailRow icon={User} label={t("admin.carsPending.sellerId")} value={car.sellerId} />
                <DetailRow icon={Eye} label={t("admin.carsPending.views")} value={car.viewCount} />
                <DetailRow icon={Heart} label={t("admin.carsPending.favorites")} value={car.favoriteCount} />
                <DetailRow icon={Clock} label={t("admin.carsPending.created")} value={formatDate(car.createdAt)} />
                <DetailRow icon={Clock} label={t("admin.carsPending.updatedAt")} value={formatDate(car.updatedAt)} />
              </div>
            </div>
          </div>

          <Separator />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border"
            >
              {t("admin.carsPending.close")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                // TODO: Implement rejection
                onOpenChange(false);
              }}
            >
              {t("admin.carsPending.reject")}
            </Button>
            <Button
              onClick={() => {
                // TODO: Implement approval
                onOpenChange(false);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t("admin.carsPending.approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox rendered outside Dialog so it's above everything */}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={car.images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const CarsPending = () => {
  const [selectedCar, setSelectedCar] = useState<CarListing | null>(null);
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalItems = MOCK_CARS.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const pageCars = useMemo(() => {
    const start = (page - 1) * pageSize;
    return MOCK_CARS.slice(start, start + pageSize);
  }, [page, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {t("admin.carsPending.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.carsPending.subtitle")}{" "}
          <span className="font-medium text-foreground">
            {MOCK_CARS.length}
          </span>{" "}
          {t("admin.carsPending.listingsAwaiting")}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/80 bg-card/95 shadow-elevated overflow-hidden">
        <Table>
          <TableCaption className="px-4 pb-3 pt-2 text-xs text-muted-foreground">
            {t("admin.carsPending.caption")}
          </TableCaption>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.carsPending.vehicle")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.carsPending.year")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.carsPending.mileage")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.carsPending.price")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.carsPending.grade")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.carsPending.seller")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                <span className="flex items-center gap-1">
                  <Eye className="size-3.5" /> / <Heart className="size-3.5" />
                </span>
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.carsPending.created")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.carsPending.status")}
              </TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.carsPending.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageCars.map((car, idx) => (
              <TableRow
                key={`${car.id}-${idx}`}
                className="cursor-pointer transition-colors hover:bg-muted/30/60"
                onClick={() => setSelectedCar(car)}
              >
                <TableCell className="font-medium text-foreground">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-14 overflow-hidden rounded-md border border-border bg-muted">
                      <img
                        src={car.images[0]}
                        alt={`${car.makeName} ${car.modelName}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {car.makeName} {car.modelName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {car.fuelType} &middot; {car.transmission}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {car.year}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatMileage(car.mileage)}
                </TableCell>
                <TableCell className="font-semibold text-foreground">
                  {formatPrice(car.listingPrice)}
                </TableCell>
                <TableCell>
                  <Badge variant={gradeVariant(car.conditionGrade)}>
                    {car.conditionGrade}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {car.sellerName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <span className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-0.5">
                      <Eye className="size-3" />
                      {car.viewCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Heart className="size-3" />
                      {car.favoriteCount}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(car.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant="warning">{t("admin.carsPending.pending")}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div
                    className="ml-auto flex w-full max-w-[260px] flex-wrap gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="sm"
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {t("admin.carsPending.approve")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-border"
                    >
                      {t("admin.carsPending.reject")}
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

      {/* Details Dialog */}
      {selectedCar && (
        <ListingDetailsDialog
          car={selectedCar}
          open={!!selectedCar}
          onOpenChange={(open) => {
            if (!open) setSelectedCar(null);
          }}
        />
      )}
    </div>
  );
};

export default CarsPending;
