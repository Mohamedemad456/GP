import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
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
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Clock,
  Eye,
  Fuel,
  Gauge,
  Heart,
  MessageCircle,
  Palette,
  Settings2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_LISTINGS } from "@/data/mocks/listings";

export default function CarDetailsPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const isRTL = i18n.language?.startsWith("ar") ?? false;
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
    [locale],
  );
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [locale],
  );
  const numberFmt = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  if (!listing) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="mx-auto w-full max-w-sm border-border/60 text-center">
          <CardHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>{t("buyer.details.notFoundTitle")}</CardTitle>
            <CardDescription>
              {t("buyer.details.notFoundDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/feed">
              <Button className="w-full">{t("buyer.details.backToFeed")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const specs = [
    {
      icon: CalendarDays,
      label: t("buyer.details.year"),
      value: listing.year,
    },
    {
      icon: Gauge,
      label: t("buyer.details.mileage"),
      value: `${numberFmt.format(listing.mileage)} km`,
    },
    { icon: Fuel, label: t("buyer.details.fuelType"), value: listing.fuelType },
    {
      icon: Settings2,
      label: t("buyer.details.transmission"),
      value: listing.transmission,
    },
    {
      icon: Zap,
      label: t("buyer.details.engineSize"),
      value: listing.engineSize,
    },
    { icon: Palette, label: t("buyer.details.color"), value: listing.color },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      {/* Top nav */}
      <div className="mb-8 flex items-center justify-between">
        <Link
          to="/feed"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft
            className={cn("size-4 shrink-0", isRTL && "rotate-180")}
          />
          {t("buyer.details.backToFeed")}
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Eye className="size-3.5" />
            <span dir="ltr">{numberFmt.format(listing.viewCount)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Heart className="size-3.5" />
            <span dir="ltr">{numberFmt.format(listing.favoriteCount)}</span>
          </span>
        </div>
      </div>

      {/* Car title hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-8"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className="text-xs uppercase tracking-wide"
          >
            {listing.status}
          </Badge>
          <Badge
            variant={
              listing.conditionGrade.startsWith("A") ? "success" : "info"
            }
          >
            {listing.conditionGrade}
          </Badge>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-heading text-3xl font-bold sm:text-4xl">
            <span dir="ltr">
              {listing.year} {listing.make} {listing.model}
            </span>
          </h1>
          <p
            className="font-heading text-2xl font-bold text-primary sm:text-3xl"
            dir="ltr"
          >
            {currency.format(listing.listingPrice)}
          </p>
        </div>

        <p className="mt-1.5 text-sm text-muted-foreground">
          {listing.color} · {listing.engineSize} · {listing.transmission}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ── Main column ── */}
        <section className="space-y-6 lg:col-span-8">
          {/* Carousel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
          >
            <Card className="overflow-hidden border-border/60 pt-0">
              <CardContent className="p-0">
                <ImageCarousel
                  images={listing.images}
                  altBase={`${listing.make} ${listing.model}`}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Key specs grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14, ease: "easeOut" }}
          >
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t("buyer.details.vehicleDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {specs.map(({ icon: Icon, label, value }) => (
                    <div
                      key={label}
                      className="flex flex-col gap-1.5 rounded-xl bg-muted/40 px-3.5 py-3"
                    >
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Icon className="size-3.5 shrink-0" />
                        {label}
                      </span>
                      <span className="text-sm font-semibold leading-tight">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          >
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t("buyer.details.description")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-foreground/85">
                  {listing.description}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </section>

        {/* ── Sidebar ── */}
        <aside className="space-y-6 lg:col-span-4">
          {/* Pricing */}
          <motion.div
            initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.14, ease: "easeOut" }}
          >
            <Card className="overflow-hidden border-border/60">
              <div className="h-1 bg-primary" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t("buyer.details.pricing")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Highlight price */}
                <div className="rounded-xl bg-primary/8 px-4 py-3 text-center">
                  <p className="mb-0.5 text-xs text-muted-foreground">
                    {t("buyer.details.listingPrice")}
                  </p>
                  <p
                    className="font-heading text-2xl font-bold text-primary"
                    dir="ltr"
                  >
                    {currency.format(listing.listingPrice)}
                  </p>
                </div>

                <Separator />

                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t("buyer.details.suggestedPrice")}
                    </span>
                    <span className="font-semibold" dir="ltr">
                      {currency.format(listing.suggestedPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t("buyer.details.basePrice")}
                    </span>
                    <span className="font-semibold" dir="ltr">
                      {currency.format(listing.basePrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t("buyer.details.deduction")}
                    </span>
                    <span className="font-semibold" dir="ltr">
                      {listing.totalDeductionPercentage}%
                    </span>
                  </div>
                </div>

                <Link to="/contact" className="block">
                  <Button className="w-full gap-2 bg-primary text-primary-foreground hover:glow-primary">
                    <MessageCircle className="size-4 shrink-0" />
                    {t("buyer.details.contactSeller", "Contact Seller")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Timestamps */}
          <motion.div
            initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.22, ease: "easeOut" }}
          >
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="size-3.5 text-muted-foreground" />
                  {t("buyer.details.timeline", "Timeline")}
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border/50 text-sm">
                <Detail
                  label={t("buyer.details.createdAt")}
                  value={dateFmt.format(new Date(listing.createdAt))}
                />
                <Detail
                  label={t("buyer.details.updatedAt")}
                  value={dateFmt.format(new Date(listing.updatedAt))}
                />
                <Detail
                  label={t("buyer.details.soldAt")}
                  value={
                    listing.soldAt
                      ? dateFmt.format(new Date(listing.soldAt))
                      : "-"
                  }
                />
              </CardContent>
            </Card>
          </motion.div>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
