import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Badge, Button, PageLoader } from "@gp/design-system";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/lib";
import {
  ArrowRight,
  CheckCircle,
  Fuel,
  Gauge,
  Heart,
  Search,
  Shield,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import heroCarImage from "@/assets/hero-car4.jpg";
import { getApprovedListings, type BuyerListingDto } from "@/lib/listingsApi";
import { getFavorites, addFavorite, removeFavorite } from "@/lib/favoritesApi";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5082";

function resolvePhotoUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${BASE_URL}${path}`;
}

const Home = () => {
  const { t, i18n } = useTranslation();
  const isRTL = useMemo(
    () => i18n.language?.startsWith("ar") ?? false,
    [i18n.language],
  );

  const [query, setQuery] = useState("");
  const [make, setMake] = useState<string>("all");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sort, setSort] = useState<
    "featured" | "priceAsc" | "priceDesc" | "yearDesc"
  >("featured");
  const [savedCarIds, setSavedCarIds] = useState<Set<string>>(new Set());
  const [apiListings, setApiListings] = useState<BuyerListingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchListings = getApprovedListings({ pageSize: 100 }).then((res) => {
      if (res.success && res.data) {
        setApiListings(res.data.data);
      }
    });

    const fetchFavs = user
      ? getFavorites({ pageSize: 100 }).then((res) => {
          if (res.success && res.data) {
            setSavedCarIds(new Set(res.data.data.map((fav) => String(fav.id))));
          }
        }).catch(() => {})
      : Promise.resolve();

    Promise.all([fetchListings, fetchFavs]).finally(() => setIsLoading(false));
  }, [user]);

  const makeOptions = useMemo(() => {
    const set = new Set(apiListings.map((c) => c.makeName));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [apiListings]);

  const filteredCars = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;

    const withinPrice = (price: number | null) => {
      if (price === null) return true;
      if (Number.isFinite(min) && min !== null && price < min) return false;
      if (Number.isFinite(max) && max !== null && price > max) return false;
      return true;
    };

    const matches = (car: BuyerListingDto) => {
      if (make !== "all" && car.makeName !== make) return false;
      if (!withinPrice(car.listingPrice)) return false;
      if (!q) return true;
      const haystack =
        `${car.makeName} ${car.modelName} ${car.year} ${car.location}`.toLowerCase();
      return haystack.includes(q);
    };

    const list = apiListings.filter(matches);

    const sorters: Record<
      typeof sort,
      (a: BuyerListingDto, b: BuyerListingDto) => number
    > = {
      featured: (a, b) => {
        const af = a.isGoodDeal ? 1 : 0;
        const bf = b.isGoodDeal ? 1 : 0;
        if (bf !== af) return bf - af;
        return (a.listingPrice ?? 0) - (b.listingPrice ?? 0);
      },
      priceAsc: (a, b) => (a.listingPrice ?? 0) - (b.listingPrice ?? 0),
      priceDesc: (a, b) => (b.listingPrice ?? 0) - (a.listingPrice ?? 0),
      yearDesc: (a, b) => b.year - a.year,
    };

    return list.sort(sorters[sort]);
  }, [query, make, minPrice, maxPrice, sort, apiListings]);

  const toggleSaved = async (carId: string) => {
    if (!user) {
      toast.error(t("favorites.loginRequired", "Please log in to save favorites."));
      return;
    }

    const isSaved = savedCarIds.has(String(carId));

    setSavedCarIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(String(carId));
      else next.add(String(carId));
      return next;
    });

    try {
      if (isSaved) {
        await removeFavorite(String(carId));
      } else {
        await addFavorite(String(carId));
      }
    } catch (err) {
      setSavedCarIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(String(carId));
        else next.delete(String(carId));
        return next;
      });
      toast.error(t("favorites.toggleError", "Failed to update favorites."));
    }
  };

  const currency = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language || "en", {
        style: "currency",
        currency: "EGP",
        maximumFractionDigits: 0,
      }),
    [i18n.language],
  );

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ── Hero ── */}
      <section className="relative h-screen overflow-hidden">
        <div
          className="fixed inset-0 w-full h-full -z-10"
          style={{
            backgroundImage: `url(${heroCarImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
            willChange: "transform",
          }}
        >
          {/* Dark tint at top for white text legibility → image breathes in middle → fades to page bg at bottom */}
          <div className="absolute inset-0" />
        </div>

        <div className="relative z-10 h-full flex items-center justify-center px-4 sm:px-6 lg:px-8 pb-16">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-md shadow-sm max-w-full">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
                <span className="text-xs sm:text-sm text-white/80 font-medium">
                  {t("home.heroBadge", {
                    defaultValue: "Verified listings • Best deals",
                  })}
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6 text-white font-heading px-2">
                {t("hero.title")}
              </h1>
              <p className="text-base sm:text-xl lg:text-2xl text-white/75 mb-8 max-w-2xl mx-auto px-2">
                {t("hero.subtitle")}
              </p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              >
                <div className="flex flex-wrap items-center justify-center gap-3 px-2">
                  <a href="#browse" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto bg-primary text-primary-foreground hover:glow-primary transition-smooth text-base sm:text-lg px-8 py-6"
                    >
                      {t("hero.cta")}
                      <ArrowRight className="ms-2 h-5 w-5 shrink-0 rtl:rotate-180" />
                    </Button>
                  </a>
                  <Link to="/about" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full sm:w-auto bg-background/40 backdrop-blur-md px-8 py-6"
                    >
                      {t("home.heroSecondaryCta", {
                        defaultValue: "How it works",
                      })}
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-6 h-10 border-2 border-foreground/30 rounded-full flex justify-center"
          >
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-1 h-3 bg-foreground/50 rounded-full mt-2"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Browse Cars ── */}
      <section id="browse" className="relative z-20 bg-background py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">
                {t("home.browse.subtitle")}
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold font-heading">
                {t("home.browse.title")}
              </h2>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-full bg-muted/60 border border-border/60 text-sm text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                {t("home.browse.results", {
                  count: filteredCars.length,
                  defaultValue: "{{count}} results",
                })}
              </span>
            </div>
          </div>

          {/* Filters */}
          <Card className="border-border/60 bg-background/60 backdrop-blur-md shadow-(--shadow-sm)">
            <CardContent className="p-4 sm:p-5">
              <div className="space-y-3">
                {/* Row 1: Search · Make · Body type · Sort */}
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
                  <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t("home.browse.searchPlaceholder")}
                      className="ps-9 w-full min-w-0"
                    />
                  </div>

                  <select
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value="all">
                      {t("home.browse.filters.makeAll")}
                    </option>
                    {makeOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>


                  <select
                    value={sort}
                    onChange={(e) =>
                      setSort(
                        e.target.value as
                          | "featured"
                          | "priceAsc"
                          | "priceDesc"
                          | "yearDesc",
                      )
                    }
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value="featured">
                      {t("home.browse.sort.featured")}
                    </option>
                    <option value="priceAsc">
                      {t("home.browse.sort.priceAsc")}
                    </option>
                    <option value="priceDesc">
                      {t("home.browse.sort.priceDesc")}
                    </option>
                    <option value="yearDesc">
                      {t("home.browse.sort.yearDesc")}
                    </option>
                  </select>
                </div>

                {/* Row 2: Price range · Actions */}
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                  <Input
                    inputMode="numeric"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder={t("home.browse.filters.minPrice")}
                  />
                  <Input
                    inputMode="numeric"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder={t("home.browse.filters.maxPrice")}
                  />
                  <Button
                    variant="outline"
                    className="whitespace-nowrap"
                    onClick={() => {
                      setQuery("");
                      setMake("all");
                      setMinPrice("");
                      setMaxPrice("");
                      setSort("featured");
                    }}
                  >
                    {t("home.browse.clear")}
                  </Button>
                  <Link to="/contact">
                    <Button className="w-full bg-primary text-primary-foreground hover:glow-primary whitespace-nowrap">
                      {t("home.browse.help")}
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="mt-8">
            {filteredCars.length === 0 ? (
              <Card className="border-border/60 bg-muted/20">
                <CardContent className="p-12 text-center">
                  <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Search className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-base font-semibold">
                    {t("home.browse.empty.title")}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {t("home.browse.empty.subtitle")}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredCars.map((car, idx) => {
                  const imageUrl = resolvePhotoUrl(car.primaryPhotoUrl);
                  return (
                  <motion.div
                    key={car.id}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min(idx, 6) * 0.04 }}
                    className="min-w-0"
                  >
                    <Card className="group h-full overflow-hidden border-border/60 hover:shadow-(--shadow-md) hover:border-border transition-all duration-200 flex flex-col min-w-0">
                      {/* Image */}
                      <div className="relative aspect-16/10 overflow-hidden">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={`${car.makeName} ${car.modelName}`}
                            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-muted">
                            <Gauge className="h-10 w-10 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />

                        {/* Badges */}
                        <div className="absolute start-3 top-3 flex gap-1.5 flex-wrap">
                          {car.isGoodDeal && (
                            <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5">
                              {t("home.browse.featured")}
                            </Badge>
                          )}
                        </div>

                        {/* Save button — floats over the image */}
                        <button
                          type="button"
                          onClick={() => toggleSaved(String(car.id))}
                          className="absolute end-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-border/60 hover:bg-background transition-colors"
                          aria-label={t("home.browse.save")}
                        >
                          <Heart
                            className={`h-4 w-4 transition-colors ${
                              savedCarIds.has(String(car.id))
                                ? "fill-destructive text-destructive"
                                : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      </div>

                      <CardContent className="p-4 flex flex-col flex-1 min-w-0">
                        {/* Title + Price */}
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground truncate mb-0.5">
                              {car.location}
                            </p>
                            <h3 className="text-base font-bold font-heading truncate text-foreground leading-tight">
                              {car.makeName} {car.modelName}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <span dir="ltr">{car.year}</span>
                            </p>
                          </div>
                          <div className="text-end shrink-0">
                            <p className="text-[11px] text-muted-foreground">
                              {t("home.browse.priceFrom")}
                            </p>
                            <p className="text-base font-semibold text-primary whitespace-nowrap">
                              <span dir="ltr">
                                {car.listingPrice !== null ? currency.format(car.listingPrice) : "N/A"}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Specs */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border/50 pt-3 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Gauge className="h-3.5 w-3.5 opacity-60 shrink-0" />
                            <span dir="ltr">
                              {car.mileage.toLocaleString()} km
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Fuel className="h-3.5 w-3.5 opacity-60 shrink-0" />
                            {car.fuelType}
                          </span>
                          <span className="truncate">{car.transmission}</span>
                        </div>

                        {/* CTA */}
                        <div className="mt-auto pt-3">
                          <Link to={`/cars/${car.id}`} className="block">
                            <Button
                              variant="outline"
                              className="w-full group-hover:border-primary/50 group-hover:text-primary transition-colors"
                            >
                              <span className="text-sm">
                                {t("home.browse.viewDetails")}
                              </span>
                              <ArrowRight className="ms-1.5 h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rtl:rotate-180" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-20 bg-muted/20 border-y border-border/40 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 font-heading text-white/90">
              {t("home.features.title")}
            </h2>
            <p className="text-base text-white/65 max-w-xl mx-auto">
              {t("home.features.subtitle")}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Search,
                title: t("home.features.search.title"),
                description: t("home.features.search.description"),
              },
              {
                icon: Shield,
                title: t("home.features.verified.title"),
                description: t("home.features.verified.description"),
              },
              {
                icon: TrendingUp,
                title: t("home.features.bestPrice.title"),
                description: t("home.features.bestPrice.description"),
              },
              {
                icon: Users,
                title: t("home.features.support.title"),
                description: t("home.features.support.description"),
              },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-(--shadow-md) transition-shadow relative overflow-hidden group border-border/60">
                    {/* Ghost number */}
                    <span
                      className="absolute top-4 end-4 text-5xl font-bold text-primary/6 font-heading leading-none select-none pointer-events-none"
                      aria-hidden
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <CardHeader className="pb-2">
                      <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-base font-semibold">
                        {feature.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-sm leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="relative z-20 bg-background py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 font-heading">
              {t("home.testimonials.title")}
            </h2>
            <p className="text-base text-muted-foreground dark:text-white/70 max-w-xl mx-auto">
              {t("home.testimonials.subtitle")}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: t("home.testimonials.testimonial1.name"),
                role: t("home.testimonials.testimonial1.role"),
                content: t("home.testimonials.testimonial1.content"),
                rating: 5,
              },
              {
                name: t("home.testimonials.testimonial2.name"),
                role: t("home.testimonials.testimonial2.role"),
                content: t("home.testimonials.testimonial2.content"),
                rating: 5,
              },
              {
                name: t("home.testimonials.testimonial3.name"),
                role: t("home.testimonials.testimonial3.role"),
                content: t("home.testimonials.testimonial3.content"),
                rating: 5,
              },
            ].map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full border-border/60 flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-0.5 mb-3">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star
                          key={i}
                          className="h-3.5 w-3.5 fill-primary text-primary"
                        />
                      ))}
                    </div>
                    <div className="relative">
                      <span
                        className="absolute -top-1 -start-0.5 text-5xl text-primary/10 font-heading leading-none select-none"
                        aria-hidden
                      >
                        "
                      </span>
                      <CardDescription className="text-sm leading-relaxed pt-5">
                        {testimonial.content}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto pt-4 border-t border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {testimonial.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold">
                          {testimonial.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {testimonial.role}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ── */}
      <section className="relative z-20 bg-muted/20 border-y border-border/40 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <Card className="border-border/60 overflow-hidden h-full">
                <div className="h-1 bg-primary" />
                <CardContent className="p-8">
                  <h2 className="text-3xl sm:text-4xl font-bold mb-3 font-heading">
                    {t("home.whyChoose.title")}
                  </h2>
                  <p className="text-base text-muted-foreground mb-8">
                    {t("home.whyChoose.subtitle")}
                  </p>
                  <div className="space-y-4">
                    {[
                      t("home.whyChoose.reason1"),
                      t("home.whyChoose.reason2"),
                      t("home.whyChoose.reason3"),
                      t("home.whyChoose.reason4"),
                    ].map((reason, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-3"
                      >
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm leading-relaxed">{reason}</span>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: isRTL ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <Card className="border-border/60 overflow-hidden">
                {/* Primary accent line at top of card */}
                <div className="h-1 bg-primary" />
                <CardContent className="p-8">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-xl mb-3">
                    {t("home.whyChoose.cardTitle")}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed mb-6">
                    {t("home.whyChoose.cardDescription")}
                  </CardDescription>
                  <Link to="/about">
                    <Button variant="outline" className="group">
                      {t("home.whyChoose.learnMore")}
                      <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-all" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-20 py-24 bg-background overflow-hidden">
        {/* Subtle bloom + hairline borders for section definition */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent" />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-[700px] rounded-full bg-primary/6 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 font-heading">
              {t("home.cta.title")}
            </h2>
            <p className="text-base text-muted-foreground dark:text-white/70 mb-10 max-w-xl mx-auto">
              {t("home.cta.description")}
            </p>
            <div className="flex gap-3 sm:gap-4 justify-center flex-wrap px-2">
              <Link to="/contact" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-primary text-primary-foreground hover:glow-primary"
                >
                  {t("home.cta.contact")}
                </Button>
              </Link>
              <Link to="/about" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  {t("home.cta.learnMore")}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
