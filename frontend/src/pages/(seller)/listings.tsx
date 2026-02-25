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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from "@gp/design-system";
import {
  Search,
  Eye,
  Heart,
  Calendar,
  Fuel,
  Gauge,
  Settings2,
  X,
  Car,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SellerListing {
  id: number;
  sellerId: string;
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

const MOCK_LISTINGS: SellerListing[] = [
  {
    id: 1, sellerId: "s1", makeId: 1, makeName: "Toyota", modelId: 1, modelName: "Camry",
    year: 2024, mileage: 12000, fuelType: "Gasoline", transmission: "Automatic", engineSize: "2.5L",
    color: "White", description: "Excellent condition 2024 Toyota Camry XLE with premium package, leather seats, panoramic sunroof, and advanced safety features.",
    basePrice: 135000, totalDeductionPercentage: 5, suggestedPrice: 128250, listingPrice: 128000,
    conditionGrade: "A+", status: "Active", rejectionReason: null, approvedByAdminId: "admin1",
    viewCount: 342, favoriteCount: 28, createdAt: "2025-01-15T10:30:00Z", updatedAt: "2025-02-10T14:20:00Z",
    approvedAt: "2025-01-16T09:00:00Z", soldAt: null,
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=Camry+1", "https://placehold.co/600x400/e2e8f0/64748b?text=Camry+2", "https://placehold.co/600x400/e2e8f0/64748b?text=Camry+3"],
  },
  {
    id: 2, sellerId: "s1", makeId: 3, makeName: "BMW", modelId: 8, modelName: "3 Series",
    year: 2023, mileage: 28000, fuelType: "Gasoline", transmission: "Automatic", engineSize: "2.0L",
    color: "Black", description: "Sporty BMW 330i M Sport with M Performance package, heads-up display, Harman Kardon audio, and full service history.",
    basePrice: 225000, totalDeductionPercentage: 8, suggestedPrice: 207000, listingPrice: 215000,
    conditionGrade: "A", status: "Sold", rejectionReason: null, approvedByAdminId: "admin1",
    viewCount: 298, favoriteCount: 24, createdAt: "2024-11-20T08:15:00Z", updatedAt: "2025-01-05T16:30:00Z",
    approvedAt: "2024-11-21T10:00:00Z", soldAt: "2025-01-05T16:30:00Z",
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=BMW+1", "https://placehold.co/600x400/e2e8f0/64748b?text=BMW+2", "https://placehold.co/600x400/e2e8f0/64748b?text=BMW+3"],
  },
  {
    id: 3, sellerId: "s1", makeId: 2, makeName: "Honda", modelId: 6, modelName: "Accord",
    year: 2024, mileage: 8000, fuelType: "Hybrid", transmission: "Automatic", engineSize: "2.0L",
    color: "Silver", description: "Fuel-efficient Honda Accord Hybrid with sensing suite, wireless Apple CarPlay, heated seats, and LED headlights.",
    basePrice: 148000, totalDeductionPercentage: 4, suggestedPrice: 142080, listingPrice: 142000,
    conditionGrade: "A+", status: "Active", rejectionReason: null, approvedByAdminId: "admin1",
    viewCount: 256, favoriteCount: 21, createdAt: "2025-01-28T12:00:00Z", updatedAt: "2025-02-12T09:45:00Z",
    approvedAt: "2025-01-29T08:30:00Z", soldAt: null,
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=Accord+1", "https://placehold.co/600x400/e2e8f0/64748b?text=Accord+2", "https://placehold.co/600x400/e2e8f0/64748b?text=Accord+3", "https://placehold.co/600x400/e2e8f0/64748b?text=Accord+4"],
  },
  {
    id: 4, sellerId: "s1", makeId: 4, makeName: "Mercedes-Benz", modelId: 11, modelName: "C-Class",
    year: 2023, mileage: 35000, fuelType: "Gasoline", transmission: "Automatic", engineSize: "1.5L",
    color: "Gray", description: "Elegant Mercedes-Benz C200 with AMG Line package, MBUX infotainment, 360-degree camera, and ambient lighting.",
    basePrice: 210000, totalDeductionPercentage: 10, suggestedPrice: 189000, listingPrice: 198000,
    conditionGrade: "A-", status: "Active", rejectionReason: null, approvedByAdminId: "admin1",
    viewCount: 234, favoriteCount: 19, createdAt: "2025-01-05T14:30:00Z", updatedAt: "2025-02-08T11:15:00Z",
    approvedAt: "2025-01-06T09:00:00Z", soldAt: null,
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=Mercedes+1", "https://placehold.co/600x400/e2e8f0/64748b?text=Mercedes+2", "https://placehold.co/600x400/e2e8f0/64748b?text=Mercedes+3"],
  },
  {
    id: 5, sellerId: "s1", makeId: 5, makeName: "Nissan", modelId: 14, modelName: "Patrol",
    year: 2022, mileage: 45000, fuelType: "Gasoline", transmission: "Automatic", engineSize: "5.6L",
    color: "White", description: "Powerful Nissan Patrol V8 Platinum with full luxury package, rear entertainment, cooled seats, and advanced off-road capabilities.",
    basePrice: 295000, totalDeductionPercentage: 12, suggestedPrice: 259600, listingPrice: 285000,
    conditionGrade: "A-", status: "Sold", rejectionReason: null, approvedByAdminId: "admin1",
    viewCount: 212, favoriteCount: 32, createdAt: "2024-10-10T09:00:00Z", updatedAt: "2024-12-20T15:00:00Z",
    approvedAt: "2024-10-11T10:00:00Z", soldAt: "2024-12-20T15:00:00Z",
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=Patrol+1", "https://placehold.co/600x400/e2e8f0/64748b?text=Patrol+2", "https://placehold.co/600x400/e2e8f0/64748b?text=Patrol+3"],
  },
  {
    id: 6, sellerId: "s1", makeId: 6, makeName: "Hyundai", modelId: 17, modelName: "Tucson",
    year: 2024, mileage: 5000, fuelType: "Hybrid", transmission: "Automatic", engineSize: "1.6L",
    color: "Blue", description: "Brand new Hyundai Tucson Hybrid with full option, BOSE audio, digital key, and Hyundai SmartSense safety features.",
    basePrice: 132000, totalDeductionPercentage: 3, suggestedPrice: 128040, listingPrice: 129000,
    conditionGrade: "A+", status: "Pending", rejectionReason: null, approvedByAdminId: null,
    viewCount: 0, favoriteCount: 0, createdAt: "2025-02-10T16:00:00Z", updatedAt: "2025-02-10T16:00:00Z",
    approvedAt: null, soldAt: null,
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=Tucson+1", "https://placehold.co/600x400/e2e8f0/64748b?text=Tucson+2", "https://placehold.co/600x400/e2e8f0/64748b?text=Tucson+3"],
  },
  {
    id: 7, sellerId: "s1", makeId: 1, makeName: "Toyota", modelId: 3, modelName: "Land Cruiser",
    year: 2023, mileage: 22000, fuelType: "Gasoline", transmission: "Automatic", engineSize: "3.5L",
    color: "Black", description: "Toyota Land Cruiser GR Sport with twin-turbo V6, adaptive variable suspension, and multi-terrain system.",
    basePrice: 380000, totalDeductionPercentage: 6, suggestedPrice: 357200, listingPrice: 365000,
    conditionGrade: "A", status: "Active", rejectionReason: null, approvedByAdminId: "admin1",
    viewCount: 189, favoriteCount: 15, createdAt: "2025-02-01T11:00:00Z", updatedAt: "2025-02-12T08:30:00Z",
    approvedAt: "2025-02-02T09:00:00Z", soldAt: null,
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=LC+1", "https://placehold.co/600x400/e2e8f0/64748b?text=LC+2", "https://placehold.co/600x400/e2e8f0/64748b?text=LC+3"],
  },
  {
    id: 8, sellerId: "s1", makeId: 2, makeName: "Honda", modelId: 5, modelName: "Civic",
    year: 2024, mileage: 3000, fuelType: "Gasoline", transmission: "Manual", engineSize: "1.5L",
    color: "Red", description: "Sporty Honda Civic Si with turbocharged engine, limited slip differential, adaptive dampers, and Bose audio.",
    basePrice: 118000, totalDeductionPercentage: 2, suggestedPrice: 115640, listingPrice: 116000,
    conditionGrade: "A+", status: "Pending", rejectionReason: null, approvedByAdminId: null,
    viewCount: 0, favoriteCount: 0, createdAt: "2025-02-12T09:00:00Z", updatedAt: "2025-02-12T09:00:00Z",
    approvedAt: null, soldAt: null,
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=Civic+1", "https://placehold.co/600x400/e2e8f0/64748b?text=Civic+2", "https://placehold.co/600x400/e2e8f0/64748b?text=Civic+3"],
  },
  {
    id: 9, sellerId: "s1", makeId: 7, makeName: "Kia", modelId: 20, modelName: "Sportage",
    year: 2023, mileage: 18000, fuelType: "Diesel", transmission: "Automatic", engineSize: "2.0L",
    color: "Green", description: "Kia Sportage GT-Line diesel with panoramic dual displays, remote smart parking, and all-wheel drive.",
    basePrice: 125000, totalDeductionPercentage: 7, suggestedPrice: 116250, listingPrice: 118000,
    conditionGrade: "B+", status: "Active", rejectionReason: null, approvedByAdminId: "admin1",
    viewCount: 156, favoriteCount: 12, createdAt: "2025-01-20T13:00:00Z", updatedAt: "2025-02-11T10:00:00Z",
    approvedAt: "2025-01-21T09:00:00Z", soldAt: null,
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=Sportage+1", "https://placehold.co/600x400/e2e8f0/64748b?text=Sportage+2", "https://placehold.co/600x400/e2e8f0/64748b?text=Sportage+3"],
  },
  {
    id: 10, sellerId: "s1", makeId: 8, makeName: "Ford", modelId: 24, modelName: "Explorer",
    year: 2021, mileage: 65000, fuelType: "Gasoline", transmission: "Automatic", engineSize: "3.0L",
    color: "Brown", description: "Ford Explorer ST with twin-turbo V6, sport-tuned suspension, and third-row seating.",
    basePrice: 165000, totalDeductionPercentage: 18, suggestedPrice: 135300, listingPrice: 140000,
    conditionGrade: "B", status: "Rejected", rejectionReason: "Photos do not meet quality standards. Please upload clearer images of the exterior and interior.",
    approvedByAdminId: null, viewCount: 0, favoriteCount: 0,
    createdAt: "2025-02-05T10:00:00Z", updatedAt: "2025-02-06T14:00:00Z",
    approvedAt: null, soldAt: null,
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=Explorer+1", "https://placehold.co/600x400/e2e8f0/64748b?text=Explorer+2", "https://placehold.co/600x400/e2e8f0/64748b?text=Explorer+3"],
  },
  {
    id: 11, sellerId: "s1", makeId: 1, makeName: "Toyota", modelId: 2, modelName: "Corolla",
    year: 2023, mileage: 20000, fuelType: "Gasoline", transmission: "Automatic", engineSize: "1.8L",
    color: "Silver", description: "Reliable Toyota Corolla with Toyota Safety Sense, adaptive cruise control, and excellent fuel economy.",
    basePrice: 88000, totalDeductionPercentage: 6, suggestedPrice: 82720, listingPrice: 85000,
    conditionGrade: "A", status: "Sold", rejectionReason: null, approvedByAdminId: "admin1",
    viewCount: 178, favoriteCount: 14, createdAt: "2024-09-15T10:00:00Z", updatedAt: "2024-11-28T12:00:00Z",
    approvedAt: "2024-09-16T09:00:00Z", soldAt: "2024-11-28T12:00:00Z",
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=Corolla+1", "https://placehold.co/600x400/e2e8f0/64748b?text=Corolla+2", "https://placehold.co/600x400/e2e8f0/64748b?text=Corolla+3"],
  },
  {
    id: 12, sellerId: "s1", makeId: 5, makeName: "Nissan", modelId: 15, modelName: "Altima",
    year: 2024, mileage: 10000, fuelType: "Gasoline", transmission: "Automatic", engineSize: "2.5L",
    color: "White", description: "Nissan Altima SR with ProPILOT assist, all-wheel drive, Bose audio, and sport-tuned CVT.",
    basePrice: 115000, totalDeductionPercentage: 4, suggestedPrice: 110400, listingPrice: 112000,
    conditionGrade: "A", status: "Active", rejectionReason: null, approvedByAdminId: "admin1",
    viewCount: 134, favoriteCount: 10, createdAt: "2025-02-03T15:00:00Z", updatedAt: "2025-02-12T07:30:00Z",
    approvedAt: "2025-02-04T09:00:00Z", soldAt: null,
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=Altima+1", "https://placehold.co/600x400/e2e8f0/64748b?text=Altima+2", "https://placehold.co/600x400/e2e8f0/64748b?text=Altima+3"],
  },
  {
    id: 13, sellerId: "s1", makeId: 6, makeName: "Hyundai", modelId: 18, modelName: "Elantra",
    year: 2024, mileage: 6500, fuelType: "Gasoline", transmission: "Automatic", engineSize: "2.0L",
    color: "White", description: "Modern Hyundai Elantra N Line with sport suspension, dual clutch transmission, and digital cockpit.",
    basePrice: 105000, totalDeductionPercentage: 3, suggestedPrice: 101850, listingPrice: 102000,
    conditionGrade: "A+", status: "Pending", rejectionReason: null, approvedByAdminId: null,
    viewCount: 0, favoriteCount: 0, createdAt: "2025-02-13T08:00:00Z", updatedAt: "2025-02-13T08:00:00Z",
    approvedAt: null, soldAt: null,
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=Elantra+1", "https://placehold.co/600x400/e2e8f0/64748b?text=Elantra+2", "https://placehold.co/600x400/e2e8f0/64748b?text=Elantra+3"],
  },
  {
    id: 14, sellerId: "s1", makeId: 3, makeName: "BMW", modelId: 10, modelName: "X5",
    year: 2022, mileage: 40000, fuelType: "Diesel", transmission: "Automatic", engineSize: "3.0L",
    color: "Blue", description: "BMW X5 xDrive30d M Sport with air suspension, panoramic glass roof, and gesture control.",
    basePrice: 310000, totalDeductionPercentage: 14, suggestedPrice: 266600, listingPrice: 275000,
    conditionGrade: "A-", status: "Active", rejectionReason: null, approvedByAdminId: "admin1",
    viewCount: 198, favoriteCount: 22, createdAt: "2025-01-10T10:00:00Z", updatedAt: "2025-02-11T16:00:00Z",
    approvedAt: "2025-01-11T09:00:00Z", soldAt: null,
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=X5+1", "https://placehold.co/600x400/e2e8f0/64748b?text=X5+2", "https://placehold.co/600x400/e2e8f0/64748b?text=X5+3"],
  },
  {
    id: 15, sellerId: "s1", makeId: 4, makeName: "Mercedes-Benz", modelId: 12, modelName: "E-Class",
    year: 2023, mileage: 15000, fuelType: "Hybrid", transmission: "Automatic", engineSize: "2.0L",
    color: "Black", description: "Mercedes-Benz E300 Hybrid with MBUX superscreen, Burmester audio, air body control, and rear axle steering.",
    basePrice: 340000, totalDeductionPercentage: 7, suggestedPrice: 316200, listingPrice: 320000,
    conditionGrade: "A", status: "Sold", rejectionReason: null, approvedByAdminId: "admin1",
    viewCount: 267, favoriteCount: 26, createdAt: "2024-12-01T09:00:00Z", updatedAt: "2025-01-18T14:00:00Z",
    approvedAt: "2024-12-02T09:00:00Z", soldAt: "2025-01-18T14:00:00Z",
    images: ["https://placehold.co/600x400/e2e8f0/64748b?text=E-Class+1", "https://placehold.co/600x400/e2e8f0/64748b?text=E-Class+2", "https://placehold.co/600x400/e2e8f0/64748b?text=E-Class+3"],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat("en-SA", {
  style: "currency",
  currency: "SAR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function fmtCurrency(val: number) {
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

const statusVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case "active": return "success" as const;
    case "pending": return "warning" as const;
    case "sold": return "info" as const;
    case "rejected": return "destructive" as const;
    default: return "secondary" as const;
  }
};

// ─── Image Gallery in Dialog ─────────────────────────────────────────────────

const ImageGallery = memo(({ images }: { images: string[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <div className="space-y-2">
      {/* Main image */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
        <img
          src={images[currentIndex]}
          alt={`Photo ${currentIndex + 1}`}
          className="size-full object-cover"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md hover:bg-background transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md hover:bg-background transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
            <span className="absolute bottom-2 right-2 rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground">
              {currentIndex + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`shrink-0 size-16 overflow-hidden rounded-md border-2 transition-colors ${
                i === currentIndex ? "border-primary" : "border-transparent hover:border-muted-foreground/30"
              }`}
            >
              <img src={img} alt={`Thumb ${i + 1}`} className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
ImageGallery.displayName = "ImageGallery";

// ─── Listing Detail Dialog ───────────────────────────────────────────────────

const ListingDetailDialog = memo(
  ({ listing, open, onClose }: { listing: SellerListing | null; open: boolean; onClose: () => void }) => {
    const { t } = useTranslation();
    if (!listing) return null;

    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {listing.year} {listing.makeName} {listing.modelName}
              <Badge variant={statusVariant(listing.status)} className="text-[10px]">
                {listing.status}
              </Badge>
            </DialogTitle>
            <DialogDescription>{listing.description}</DialogDescription>
          </DialogHeader>

          {/* Images */}
          <ImageGallery images={listing.images} />

          <Separator />

          {/* Vehicle Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">{t("seller.listings.detail.vehicleDetails")}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <DetailItem label={t("seller.listings.detail.make")} value={listing.makeName} />
              <DetailItem label={t("seller.listings.detail.model")} value={listing.modelName} />
              <DetailItem label={t("seller.listings.detail.year")} value={listing.year.toString()} />
              <DetailItem label={t("seller.listings.detail.mileage")} value={fmtMileage(listing.mileage)} />
              <DetailItem label={t("seller.listings.detail.fuelType")} value={listing.fuelType} />
              <DetailItem label={t("seller.listings.detail.transmission")} value={listing.transmission} />
              <DetailItem label={t("seller.listings.detail.engineSize")} value={listing.engineSize} />
              <DetailItem label={t("seller.listings.detail.color")} value={listing.color} />
              <DetailItem label={t("seller.listings.detail.conditionGrade")} value={listing.conditionGrade} />
            </div>
          </div>

          <Separator />

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">{t("seller.listings.detail.pricing")}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DetailItem label={t("seller.listings.detail.basePrice")} value={fmtCurrency(listing.basePrice)} />
              <DetailItem label={t("seller.listings.detail.deduction")} value={`${listing.totalDeductionPercentage}%`} />
              <DetailItem label={t("seller.listings.detail.suggestedPrice")} value={fmtCurrency(listing.suggestedPrice)} />
              <DetailItem label={t("seller.listings.detail.listingPrice")} value={fmtCurrency(listing.listingPrice)} highlight />
            </div>
          </div>

          <Separator />

          {/* Engagement */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">{t("seller.listings.detail.engagement")}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DetailItem label={t("seller.listings.detail.views")} value={listing.viewCount.toLocaleString()} />
              <DetailItem label={t("seller.listings.detail.favorites")} value={listing.favoriteCount.toLocaleString()} />
              <DetailItem label={t("seller.listings.detail.createdAt")} value={fmtDate(listing.createdAt)} />
              <DetailItem
                label={t("seller.listings.detail.updatedAt")}
                value={fmtDate(listing.updatedAt)}
              />
            </div>
          </div>

          {/* Rejection Reason */}
          {listing.rejectionReason && (
            <>
              <Separator />
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">{t("seller.listings.detail.rejectionReason")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{listing.rejectionReason}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);
ListingDetailDialog.displayName = "ListingDetailDialog";

// ─── Detail item helper ──────────────────────────────────────────────────────

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const SellerListings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fuelFilter, setFuelFilter] = useState("all");
  const [transmissionFilter, setTransmissionFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Dialog
  const [selectedListing, setSelectedListing] = useState<SellerListing | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenDetail = useCallback((listing: SellerListing) => {
    setSelectedListing(listing);
    setDialogOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDialogOpen(false);
    setSelectedListing(null);
  }, []);

  const hasActiveFilters = search || statusFilter !== "all" || fuelFilter !== "all" || transmissionFilter !== "all" || conditionFilter !== "all";

  const clearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("all");
    setFuelFilter("all");
    setTransmissionFilter("all");
    setConditionFilter("all");
    setSortBy("newest");
  }, []);

  const filtered = useMemo(() => {
    let result = [...MOCK_LISTINGS];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.makeName.toLowerCase().includes(q) ||
          l.modelName.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.year.toString().includes(q)
      );
    }

    // Status
    if (statusFilter !== "all") {
      result = result.filter((l) => l.status.toLowerCase() === statusFilter);
    }

    // Fuel
    if (fuelFilter !== "all") {
      result = result.filter((l) => l.fuelType.toLowerCase() === fuelFilter);
    }

    // Transmission
    if (transmissionFilter !== "all") {
      result = result.filter((l) => l.transmission.toLowerCase() === transmissionFilter);
    }

    // Condition
    if (conditionFilter !== "all") {
      result = result.filter((l) => l.conditionGrade === conditionFilter);
    }

    // Sort
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "priceHigh":
        result.sort((a, b) => b.listingPrice - a.listingPrice);
        break;
      case "priceLow":
        result.sort((a, b) => a.listingPrice - b.listingPrice);
        break;
      case "mostViewed":
        result.sort((a, b) => b.viewCount - a.viewCount);
        break;
      case "mostFavorited":
        result.sort((a, b) => b.favoriteCount - a.favoriteCount);
        break;
    }

    return result;
  }, [search, statusFilter, fuelFilter, transmissionFilter, conditionFilter, sortBy]);

  // Pagination for card grid
  const [page, setPage] = useState(1);
  const pageSize = 6;

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, fuelFilter, transmissionFilter, conditionFilter, sortBy]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalItems, page * pageSize);

  const pageListings = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {t("seller.listings.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("seller.listings.subtitle", { count: filtered.length })}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("seller.listings.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("seller.listings.filters.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("seller.listings.filters.allStatuses")}</SelectItem>
                <SelectItem value="active">{t("seller.listings.filters.active")}</SelectItem>
                <SelectItem value="pending">{t("seller.listings.filters.pending")}</SelectItem>
                <SelectItem value="sold">{t("seller.listings.filters.sold")}</SelectItem>
                <SelectItem value="rejected">{t("seller.listings.filters.rejected")}</SelectItem>
              </SelectContent>
            </Select>

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

            {/* Condition */}
            <Select value={conditionFilter} onValueChange={setConditionFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("seller.listings.filters.condition")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("seller.listings.filters.allConditions")}</SelectItem>
                <SelectItem value="A+">A+</SelectItem>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="A-">A-</SelectItem>
                <SelectItem value="B+">B+</SelectItem>
                <SelectItem value="B">B</SelectItem>
                <SelectItem value="C+">C+</SelectItem>
                <SelectItem value="C">C</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort + Clear */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">{t("seller.listings.sortBy")}:</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("seller.listings.sort.newest")}</SelectItem>
                  <SelectItem value="oldest">{t("seller.listings.sort.oldest")}</SelectItem>
                  <SelectItem value="priceHigh">{t("seller.listings.sort.priceHigh")}</SelectItem>
                  <SelectItem value="priceLow">{t("seller.listings.sort.priceLow")}</SelectItem>
                  <SelectItem value="mostViewed">{t("seller.listings.sort.mostViewed")}</SelectItem>
                  <SelectItem value="mostFavorited">{t("seller.listings.sort.mostFavorited")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-xs text-muted-foreground">
                <X className="size-3" />
                {t("seller.listings.clearFilters")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Listings Grid */}
      {totalItems === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Car className="size-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">{t("seller.listings.empty.title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("seller.listings.empty.subtitle")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pageListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} onClick={() => handleOpenDetail(listing)} t={t} />
            ))}
          </div>

          {/* Global pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex flex-col items-center gap-3 text-xs text-muted-foreground">
              <div className="text-[11px] text-muted-foreground/90">
                {t(
                  "seller.listings.paginationSummary",
                  "Showing {{from}}–{{to}} of {{total}} listings",
                  { from, to, total: totalItems },
                )}
              </div>
              <Pagination className="mx-0 w-auto justify-center" dir="ltr">
                <PaginationContent className="gap-1 rounded-xl bg-card/80 px-2 py-1.5 shadow-sm border border-border/70 sm:gap-1.5 sm:rounded-full sm:px-2.5">
                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      size="icon"
                      aria-label={t("seller.listings.prevPage", "Previous page")}
                      className={`size-8 sm:size-9 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2.5 ${page === 1 ? "pointer-events-none opacity-40" : ""}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.max(1, p - 1));
                      }}
                    >
                      <ChevronLeft className="size-4" />
                      <span className="hidden sm:inline">
                        {t("seller.listings.prev", "Previous")}
                      </span>
                    </PaginationLink>
                  </PaginationItem>

                  {visiblePages.map((pageNumber, index) => {
                    const previousPage = visiblePages[index - 1];
                    const items = [];

                    if (index > 0 && previousPage !== undefined && pageNumber - previousPage > 1) {
                      items.push(
                        <PaginationItem key={`ellipsis-${previousPage}-${pageNumber}`}>
                          <PaginationEllipsis className="size-8 sm:size-9" />
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
                          className="size-8 sm:size-9"
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
                      size="icon"
                      aria-label={t("seller.listings.nextPage", "Next page")}
                      className={`size-8 sm:size-9 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2.5 ${page === totalPages ? "pointer-events-none opacity-40" : ""}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.min(totalPages, p + 1));
                      }}
                    >
                      <span className="hidden sm:inline">
                        {t("seller.listings.next", "Next")}
                      </span>
                      <ChevronRight className="size-4" />
                    </PaginationLink>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}

      {/* Detail Dialog */}
      <ListingDetailDialog listing={selectedListing} open={dialogOpen} onClose={handleCloseDetail} />
    </div>
  );
};

// ─── Listing Card ────────────────────────────────────────────────────────────

const ListingCard = memo(
  ({ listing, onClick, t }: { listing: SellerListing; onClick: () => void; t: (key: string) => string }) => (
    <Card
      className="group cursor-pointer overflow-hidden transition-all hover:shadow-md hover:border-primary/30"
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-16/10 overflow-hidden bg-muted">
        {listing.images[0] ? (
          <img
            src={listing.images[0]}
            alt={`${listing.makeName} ${listing.modelName}`}
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageIcon className="size-12 text-muted-foreground/30" />
          </div>
        )}
        <Badge
          variant={statusVariant(listing.status)}
          className="absolute top-2 left-2 text-[10px]"
        >
          {listing.status}
        </Badge>
        <Badge
          variant={
            listing.conditionGrade.startsWith("A")
              ? "success"
              : listing.conditionGrade.startsWith("B")
                ? "info"
                : "warning"
          }
          className="absolute top-2 right-2 text-[10px]"
        >
          {listing.conditionGrade}
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
            <Calendar className="size-3" /> {fmtDate(listing.createdAt)}
          </span>
        </div>

        {/* Engagement */}
        <div className="mt-3 flex items-center gap-3 border-t border-border pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="size-3" /> {listing.viewCount} {t("seller.listings.views")}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="size-3" /> {listing.favoriteCount} {t("seller.listings.favorites")}
          </span>
        </div>
      </CardContent>
    </Card>
  )
);
ListingCard.displayName = "ListingCard";

export default SellerListings;
