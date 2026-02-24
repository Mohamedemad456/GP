import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@gp/design-system";
import { Eye, Heart, Search, SlidersHorizontal } from "lucide-react";
import { MOCK_LISTINGS } from "@/data/mocks/listings";

export default function FeedPage() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [make, setMake] = useState("all");
  const [fuelType, setFuelType] = useState("all");
  const [condition, setCondition] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [wishlistedIds, setWishlistedIds] = useState<Set<number>>(new Set());

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
  const numberFmt = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const makes = useMemo(
    () => Array.from(new Set(MOCK_LISTINGS.map((listing) => listing.make))),
    []
  );
  const fuelTypes = useMemo(
    () => Array.from(new Set(MOCK_LISTINGS.map((listing) => listing.fuelType))),
    []
  );

  const listings = useMemo(() => {
    const filtered = MOCK_LISTINGS.filter((listing) => {
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        `${listing.make} ${listing.model}`.toLowerCase().includes(normalizedQuery) ||
        listing.description.toLowerCase().includes(normalizedQuery);

      const matchesMake = make === "all" || listing.make === make;
      const matchesFuel = fuelType === "all" || listing.fuelType === fuelType;
      const matchesCondition = condition === "all" || listing.conditionGrade.startsWith(condition);
      const matchesMaxPrice =
        !maxPrice || listing.listingPrice <= Number(maxPrice);

      return matchesQuery && matchesMake && matchesFuel && matchesCondition && matchesMaxPrice;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "priceAsc":
          return a.listingPrice - b.listingPrice;
        case "priceDesc":
          return b.listingPrice - a.listingPrice;
        case "mileageAsc":
          return a.mileage - b.mileage;
        case "popular":
          return b.viewCount - a.viewCount;
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [condition, fuelType, make, maxPrice, query, sortBy]);

  const toggleWishlist = useCallback((listingId: number) => {
    setWishlistedIds((prev) => {
      const next = new Set(prev);
      if (next.has(listingId)) {
        next.delete(listingId);
      } else {
        next.add(listingId);
      }
      return next;
    });
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pt-20 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("buyer.feed.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("buyer.feed.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontal className="size-4" />
                {t("buyer.feed.filtersTitle")}
              </CardTitle>
              <CardDescription>{t("buyer.feed.filtersSubtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{t("buyer.feed.search")}</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("buyer.feed.searchPlaceholder")}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{t("buyer.feed.make")}</label>
                <Select value={make} onValueChange={setMake}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("buyer.feed.allMakes")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("buyer.feed.allMakes")}</SelectItem>
                    {makes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{t("buyer.feed.fuelType")}</label>
                <Select value={fuelType} onValueChange={setFuelType}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("buyer.feed.allFuelTypes")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("buyer.feed.allFuelTypes")}</SelectItem>
                    {fuelTypes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{t("buyer.feed.condition")}</label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("buyer.feed.allConditions")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("buyer.feed.allConditions")}</SelectItem>
                    <SelectItem value="A">{t("buyer.feed.aRange")}</SelectItem>
                    <SelectItem value="B">{t("buyer.feed.bRange")}</SelectItem>
                    <SelectItem value="C">{t("buyer.feed.cRange")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{t("buyer.feed.maxPrice")}</label>
                <Input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder={t("buyer.feed.maxPricePlaceholder")}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{t("buyer.feed.sortBy")}</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">{t("buyer.feed.sort.newest")}</SelectItem>
                    <SelectItem value="popular">{t("buyer.feed.sort.popular")}</SelectItem>
                    <SelectItem value="priceAsc">{t("buyer.feed.sort.priceAsc")}</SelectItem>
                    <SelectItem value="priceDesc">{t("buyer.feed.sort.priceDesc")}</SelectItem>
                    <SelectItem value="mileageAsc">{t("buyer.feed.sort.mileageAsc")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-4 lg:col-span-9">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
            <span className="text-muted-foreground">
              {t("buyer.feed.showing")} <span className="font-semibold text-foreground">{listings.length}</span> {t("buyer.feed.listings")}
            </span>
            <span className="text-muted-foreground">
              {t("buyer.feed.totalFavorites")}{" "}
              <span className="font-semibold text-foreground">
                {numberFmt.format(listings.reduce((sum, item) => sum + item.favoriteCount, 0))}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {listings.map((listing) => {
              const isWishlisted = wishlistedIds.has(listing.id);
              const favoriteCount = listing.favoriteCount + (isWishlisted ? 1 : 0);

              return (
              <Card key={listing.id} className="group overflow-hidden">
                <div className="overflow-hidden">
                  <img
                    src={listing.images[0]}
                    alt={`${listing.make} ${listing.model}`}
                    className="aspect-video w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">
                      {listing.year} {listing.make} {listing.model}
                    </CardTitle>
                    <Badge variant={listing.conditionGrade.startsWith("A") ? "success" : "info"}>
                      {listing.conditionGrade}
                    </Badge>
                  </div>
                  <CardDescription>
                    {listing.fuelType} • {listing.transmission} • {numberFmt.format(listing.mileage)} km
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("buyer.feed.listingPrice")}</p>
                      <p className="font-heading text-xl font-bold text-primary">
                        {currency.format(listing.listingPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="size-3.5" />
                        {numberFmt.format(listing.viewCount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="size-3.5" />
                        {numberFmt.format(favoriteCount)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => toggleWishlist(listing.id)}
                      className="gap-2"
                    >
                      <Heart
                        className={`size-4 ${
                          isWishlisted ? "fill-current text-destructive" : "text-muted-foreground"
                        }`}
                      />
                      {isWishlisted
                        ? t("buyer.feed.removeWishlist")
                        : t("buyer.feed.addWishlist")}
                    </Button>
                    <Link to={`/cars/${listing.id}`}>
                      <Button className="w-full">{t("buyer.feed.viewDetails")}</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )})}
          </div>
        </section>
      </div>
    </div>
  );
}

