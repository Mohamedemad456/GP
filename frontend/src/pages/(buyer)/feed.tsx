import { useCallback, useMemo, useState, useEffect } from "react";
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
  PageLoader,
} from "@gp/design-system";
import { Eye, Heart, Search, SlidersHorizontal, Car } from "lucide-react";
import { getApprovedListings, type BuyerListingDto } from "@/lib/listingsApi";

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
        currency: "EGP",
        maximumFractionDigits: 0,
      }),
    [locale]
  );
  const numberFmt = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const [apiListings, setApiListings] = useState<BuyerListingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const BASE_URL: string =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5082";

  function resolvePhotoUrl(url: string | null): string | null {
    if (!url) return null;
    if (url.startsWith("http") || url.startsWith("data:")) return url;
    // Ensure proper URL concatenation with leading slash
    const path = url.startsWith("/") ? url : `/${url}`;
    return `${BASE_URL}${path}`;
  }

  useEffect(() => {
    getApprovedListings({ pageSize: 100 })
      .then((res) => {
        if (res.success && res.data) {
          setApiListings(res.data.data);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const makes = useMemo(
    () => Array.from(new Set(apiListings.map((listing) => listing.makeName))),
    [apiListings]
  );
  const fuelTypes = useMemo(
    () => Array.from(new Set(apiListings.map((listing) => listing.fuelType))),
    [apiListings]
  );

  const listings = useMemo(() => {
    const filtered = apiListings.filter((listing) => {
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        `${listing.makeName} ${listing.modelName}`.toLowerCase().includes(normalizedQuery);

      const matchesMake = make === "all" || listing.makeName === make;
      const matchesFuel = fuelType === "all" || listing.fuelType === fuelType;
      // condition removed from API dto, skipping client-side condition filter.
      const matchesCondition = condition === "all";
      const matchesMaxPrice =
        !maxPrice || (listing.listingPrice !== null && listing.listingPrice <= Number(maxPrice));

      return matchesQuery && matchesMake && matchesFuel && matchesCondition && matchesMaxPrice;
    });

    return filtered.sort((a, b) => {
      const priceA = a.listingPrice ?? 0;
      const priceB = b.listingPrice ?? 0;
      switch (sortBy) {
        case "priceAsc":
          return priceA - priceB;
        case "priceDesc":
          return priceB - priceA;
        case "mileageAsc":
          return a.mileage - b.mileage;
        case "newest":
        case "popular":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [condition, fuelType, make, maxPrice, query, sortBy, apiListings]);

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

  if (isLoading) {
    return <PageLoader />;
  }

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
                {numberFmt.format(wishlistedIds.size)}
              </span>
            </span>
          </div>

          {listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-card py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <Car className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{t("buyer.feed.noResults")}</p>
                <p className="text-sm text-muted-foreground">{t("buyer.feed.noResultsDescription")}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setMake("all");
                  setFuelType("all");
                  setCondition("all");
                  setMaxPrice("");
                }}
              >
                {t("buyer.feed.clearFilters")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {listings.map((listing) => {
                const isWishlisted = wishlistedIds.has(Number(listing.id));
                const imageUrl = resolvePhotoUrl(listing.primaryPhotoUrl);

                return (
                  <Card key={listing.id} className="group overflow-hidden">
                    <div className="overflow-hidden">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={`${listing.makeName} ${listing.modelName}`}
                          className="aspect-video w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex aspect-video w-full items-center justify-center bg-muted">
                          <Car className="h-12 w-12 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <CardHeader className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">
                          {listing.year} {listing.makeName} {listing.modelName}
                        </CardTitle>
                        {listing.isGoodDeal && (
                          <Badge variant="success">Good Deal</Badge>
                        )}
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
                            {listing.listingPrice !== null ? currency.format(listing.listingPrice) : "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => toggleWishlist(Number(listing.id))}
                          className="gap-2"
                        >
                          <Heart
                            className={`size-4 ${isWishlisted ? "fill-current text-destructive" : "text-muted-foreground"
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
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

