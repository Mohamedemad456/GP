import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ImageCarousel,
  Separator,
} from "@gp/design-system";
import { ArrowLeft, Eye, Heart } from "lucide-react";
import { MOCK_LISTINGS } from "@/data/mocks/listings";

export default function CarDetailsPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const listingId = Number(id);
  const listing = MOCK_LISTINGS.find((item) => item.id === listingId);
  const locale = i18n.language?.startsWith("ar") ? "ar-SA" : "en-US";
  const currency = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "SAR",
        maximumFractionDigits: 0,
      }),
    [locale]
  );
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [locale]
  );
  const numberFmt = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  if (!listing) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>{t("buyer.details.notFoundTitle")}</CardTitle>
          <CardDescription>
            {t("buyer.details.notFoundDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/feed">
            <Button>{t("buyer.details.backToFeed")}</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pt-20 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <Link to="/feed" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          {t("buyer.details.backToFeed")}
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="size-3.5" />
            {numberFmt.format(listing.viewCount)}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="size-3.5" />
            {numberFmt.format(listing.favoriteCount)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="space-y-6 lg:col-span-8">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{listing.status}</Badge>
                <Badge variant={listing.conditionGrade.startsWith("A") ? "success" : "info"}>
                  {listing.conditionGrade}
                </Badge>
              </div>
              <CardTitle className="text-2xl">
                {listing.year} {listing.make} {listing.model}
              </CardTitle>
              <CardDescription>
                {listing.color} • {listing.engineSize} • {listing.transmission}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageCarousel images={listing.images} altBase={`${listing.make} ${listing.model}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("buyer.details.description")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/90">
                {listing.description}
              </p>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("buyer.details.pricing")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("buyer.details.listingPrice")}</span>
                <span className="font-heading text-xl font-bold text-primary">
                  {currency.format(listing.listingPrice)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("buyer.details.suggestedPrice")}</span>
                <span className="font-semibold">{currency.format(listing.suggestedPrice)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("buyer.details.basePrice")}</span>
                <span className="font-semibold">{currency.format(listing.basePrice)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("buyer.details.deduction")}</span>
                <span className="font-semibold">{listing.totalDeductionPercentage}%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("buyer.details.vehicleDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Detail label={t("buyer.details.makeId")} value={listing.makeId} />
              <Detail label={t("buyer.details.modelId")} value={listing.modelId} />
              <Detail label={t("buyer.details.year")} value={listing.year} />
              <Detail label={t("buyer.details.mileage")} value={`${numberFmt.format(listing.mileage)} km`} />
              <Detail label={t("buyer.details.fuelType")} value={listing.fuelType} />
              <Detail label={t("buyer.details.transmission")} value={listing.transmission} />
              <Detail label={t("buyer.details.engineSize")} value={listing.engineSize} />
              <Detail label={t("buyer.details.color")} value={listing.color} />
              <Detail label={t("buyer.details.sellerId")} value={listing.sellerId} />
              <Detail label={t("buyer.details.createdAt")} value={dateFmt.format(new Date(listing.createdAt))} />
              <Detail label={t("buyer.details.updatedAt")} value={dateFmt.format(new Date(listing.updatedAt))} />
              <Detail label={t("buyer.details.approvedAt")} value={listing.approvedAt ? dateFmt.format(new Date(listing.approvedAt)) : "-"} />
              <Detail label={t("buyer.details.soldAt")} value={listing.soldAt ? dateFmt.format(new Date(listing.soldAt)) : "-"} />
              <Detail label={t("buyer.details.rejectionReason")} value={listing.rejectionReason ?? "-"} />
              <Detail label={t("buyer.details.approvedByAdminId")} value={listing.approvedByAdminId ?? "-"} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

