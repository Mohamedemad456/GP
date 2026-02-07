import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Badge, Button } from "@gp/design-system";
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
  Search,
  Shield,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import heroCarImage from "@/assets/hero-car.jpg";
import type { CarListing } from "@/types";

const DEMO_CARS: CarListing[] = [
  {
    id: "1",
    make: "Toyota",
    model: "Camry",
    year: 2023,
    price: 28900,
    mileageKm: 12000,
    fuel: "Gasoline",
    transmission: "Automatic",
    bodyType: "Sedan",
    location: "Dubai",
    featured: true,
  },
  {
    id: "2",
    make: "BMW",
    model: "X5",
    year: 2022,
    price: 55900,
    mileageKm: 28000,
    fuel: "Hybrid",
    transmission: "Automatic",
    bodyType: "SUV",
    location: "Abu Dhabi",
    featured: true,
  },
  {
    id: "3",
    make: "Tesla",
    model: "Model 3",
    year: 2024,
    price: 41900,
    mileageKm: 6000,
    fuel: "Electric",
    transmission: "Automatic",
    bodyType: "Sedan",
    location: "Riyadh",
  },
  {
    id: "4",
    make: "Mercedes",
    model: "C-Class",
    year: 2021,
    price: 37900,
    mileageKm: 39000,
    fuel: "Gasoline",
    transmission: "Automatic",
    bodyType: "Sedan",
    location: "Jeddah",
  },
  {
    id: "5",
    make: "Nissan",
    model: "Patrol",
    year: 2020,
    price: 46900,
    mileageKm: 62000,
    fuel: "Gasoline",
    transmission: "Automatic",
    bodyType: "SUV",
    location: "Doha",
  },
  {
    id: "6",
    make: "Ford",
    model: "Ranger",
    year: 2022,
    price: 30900,
    mileageKm: 25000,
    fuel: "Gasoline",
    transmission: "Automatic",
    bodyType: "Pickup",
    location: "Kuwait City",
  },
  {
    id: "7",
    make: "Honda",
    model: "Civic",
    year: 2021,
    price: 21900,
    mileageKm: 34000,
    fuel: "Gasoline",
    transmission: "Automatic",
    bodyType: "Sedan",
    location: "Manama",
  },
  {
    id: "8",
    make: "Audi",
    model: "A5",
    year: 2022,
    price: 44900,
    mileageKm: 18000,
    fuel: "Gasoline",
    transmission: "Automatic",
    bodyType: "Coupe",
    location: "Sharjah",
  },
];

const Home = () => {
  const { t, i18n } = useTranslation();
  const isRTL = useMemo(
    () => i18n.language?.startsWith("ar") ?? false,
    [i18n.language],
  );

  const [query, setQuery] = useState("");
  const [make, setMake] = useState<string>("all");
  const [bodyType, setBodyType] = useState<string>("all");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sort, setSort] = useState<
    "featured" | "priceAsc" | "priceDesc" | "yearDesc"
  >("featured");

  const makeOptions = useMemo(() => {
    const set = new Set(DEMO_CARS.map((c) => c.make));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, []);

  const bodyTypeOptions = useMemo(() => {
    const set = new Set(DEMO_CARS.map((c) => c.bodyType));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, []);

  const filteredCars = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;

    const withinPrice = (price: number) => {
      if (Number.isFinite(min) && min !== null && price < min) return false;
      if (Number.isFinite(max) && max !== null && price > max) return false;
      return true;
    };

    const matches = (car: CarListing) => {
      if (make !== "all" && car.make !== make) return false;
      if (bodyType !== "all" && car.bodyType !== bodyType) return false;
      if (!withinPrice(car.price)) return false;
      if (!q) return true;
      const haystack =
        `${car.make} ${car.model} ${car.year} ${car.bodyType} ${car.location}`.toLowerCase();
      return haystack.includes(q);
    };

    const list = DEMO_CARS.filter(matches);

    const sorters: Record<
      typeof sort,
      (a: CarListing, b: CarListing) => number
    > = {
      featured: (a, b) => {
        const af = a.featured ? 1 : 0;
        const bf = b.featured ? 1 : 0;
        if (bf !== af) return bf - af;
        return a.price - b.price;
      },
      priceAsc: (a, b) => a.price - b.price,
      priceDesc: (a, b) => b.price - a.price,
      yearDesc: (a, b) => b.year - a.year,
    };

    return list.sort(sorters[sort]);
  }, [query, make, bodyType, minPrice, maxPrice, sort]);

  const currency = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language || "en", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    [i18n.language],
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Hero Section with Parallax Background */}
      <section className="relative h-screen overflow-hidden">
        {/* Fixed Background Image with Parallax Effect */}
        <div
          className="fixed inset-0 w-full h-[120%] -z-10"
          style={{
            backgroundImage: `url(${heroCarImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
            willChange: "transform",
          }}
        >
          {/* Gradient Overlay for Fade Effect */}
          <div className="absolute inset-0 bg-linear-to-b from-background/90 via-background/70 to-background/95" />
          <div className="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-background to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 h-full flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-2 sm:px-4 backdrop-blur-md shadow-sm max-w-full">
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <span className="text-xs sm:text-sm text-muted-foreground wrap-break-word">
                  {t("home.heroBadge", {
                    defaultValue: "Verified listings • Best deals",
                  })}
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6 text-foreground drop-shadow-lg font-heading px-2 wrap-break-word">
                {t("hero.title")}
              </h1>
              <p className="text-base sm:text-xl lg:text-2xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto drop-shadow-md px-2 wrap-break-word">
                {t("hero.subtitle")}
              </p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              >
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-2">
                  <a href="#browse" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto bg-primary text-primary-foreground hover:glow-primary transition-smooth font-sans text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6"
                    >
                      <span className="wrap-break-word">{t("hero.cta")}</span>
                      <ArrowRight
                        className={`ml-2 h-4 w-4 sm:h-5 sm:w-5 inline-block shrink-0 ${isRTL ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </a>
                  <Link to="/about" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full sm:w-auto bg-background/40 backdrop-blur-md text-sm sm:text-base px-6 sm:px-8 py-5 sm:py-6"
                    >
                      <span className="wrap-break-word">
                        {t("home.heroSecondaryCta", {
                          defaultValue: "How it works",
                        })}
                      </span>
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
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

      {/* Browse Cars */}
      <section id="browse" className="relative z-20 bg-background pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold font-heading">
                {t("home.browse.title")}
              </h2>
              <p className="text-lg text-muted-foreground mt-2 max-w-2xl">
                {t("home.browse.subtitle")}
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
              <span>
                {t("home.browse.results", {
                  count: filteredCars.length,
                  defaultValue: "{{count}} results",
                })}
              </span>
            </div>
          </div>

          {/* Filters */}
          <Card className="border-border/60 bg-background/60 backdrop-blur-md">
            <CardContent className="p-4 sm:p-6">
              <div className="grid gap-3 md:grid-cols-12">
                <div className="sm:col-span-2 md:col-span-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t("home.browse.searchPlaceholder")}
                      className="pl-9 w-full min-w-0"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
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
                </div>

                <div className="sm:col-span-1 md:col-span-2">
                  <select
                    value={bodyType}
                    onChange={(e) => setBodyType(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] min-w-0"
                  >
                    <option value="all">
                      {t("home.browse.filters.bodyAll")}
                    </option>
                    {bodyTypeOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Input
                    inputMode="numeric"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder={t("home.browse.filters.minPrice")}
                  />
                </div>

                <div className="md:col-span-2">
                  <Input
                    inputMode="numeric"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder={t("home.browse.filters.maxPrice")}
                  />
                </div>

                <div className="md:col-span-3">
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

                <div className="sm:col-span-2 md:col-span-3 flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto min-w-0"
                    onClick={() => {
                      setQuery("");
                      setMake("all");
                      setBodyType("all");
                      setMinPrice("");
                      setMaxPrice("");
                      setSort("featured");
                    }}
                  >
                    <span className="truncate">{t("home.browse.clear")}</span>
                  </Button>
                  <Link to="/contact" className="w-full sm:w-auto min-w-0">
                    <Button className="w-full sm:w-auto bg-primary text-primary-foreground hover:glow-primary min-w-0">
                      <span className="truncate">{t("home.browse.help")}</span>
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
                <CardContent className="p-10 text-center">
                  <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Search className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-lg font-semibold">
                    {t("home.browse.empty.title")}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {t("home.browse.empty.subtitle")}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredCars.map((car, idx) => (
                  <motion.div
                    key={car.id}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min(idx, 6) * 0.04 }}
                  >
                    <Card className="group h-full overflow-hidden border-border/60 hover:shadow-lg transition-smooth flex flex-col min-w-0">
                      <div className="relative aspect-16/10 bg-linear-to-br from-muted/40 to-muted/10 min-w-0">
                        <div className="absolute inset-0 bg-linear-to-t from-background/70 via-transparent to-transparent" />
                        <div className="absolute left-2 top-2 sm:left-4 sm:top-4 flex gap-1 sm:gap-2 flex-wrap">
                          {car.featured ? (
                            <Badge className="bg-primary text-primary-foreground px-2 py-0.5 sm:px-3 sm:py-1 text-xs">
                              <span className="truncate">
                                {t("home.browse.featured")}
                              </span>
                            </Badge>
                          ) : null}
                          <Badge
                            variant="secondary"
                            className="px-2 py-0.5 sm:px-3 sm:py-1 text-xs"
                          >
                            <span className="truncate">{car.bodyType}</span>
                          </Badge>
                        </div>
                        <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-4 flex items-end justify-between gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm text-muted-foreground truncate">
                              {car.location}
                            </div>
                            <div className="text-base sm:text-xl font-bold font-heading truncate">
                              {car.make} {car.model}
                            </div>
                            <div className="text-xs sm:text-sm text-muted-foreground">
                              {car.year}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs text-muted-foreground">
                              {t("home.browse.priceFrom")}
                            </div>
                            <div className="text-sm sm:text-lg font-semibold text-primary whitespace-nowrap">
                              {currency.format(car.price)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <CardContent className="p-3 sm:p-4 flex flex-col h-full min-w-0">
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-xs text-muted-foreground min-w-0">
                          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                            <Gauge className="h-3 w-3 sm:h-4 sm:w-4 text-foreground/70 shrink-0" />
                            <span className="truncate">
                              {car.mileageKm.toLocaleString()} km
                            </span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                            <Fuel className="h-3 w-3 sm:h-4 sm:w-4 text-foreground/70 shrink-0" />
                            <span className="truncate">{car.fuel}</span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                            <span className="h-3 w-3 sm:h-4 sm:w-4 inline-flex items-center justify-center rounded bg-muted text-foreground/70 shrink-0 text-[10px] sm:text-xs">
                              A
                            </span>
                            <span className="truncate">{car.transmission}</span>
                          </div>
                        </div>

                        <div className="mt-auto pt-3 sm:pt-4 flex gap-2 min-w-0">
                          <Button
                            variant="outline"
                            className="flex-1 transition-smooth min-w-0"
                          >
                            <span className="truncate text-xs sm:text-sm">
                              {t("home.browse.viewDetails")}
                            </span>
                          </Button>
                          <Button className="flex-1 bg-primary text-primary-foreground hover:glow-primary min-w-0">
                            <span className="truncate text-xs sm:text-sm">
                              {t("home.browse.save")}
                            </span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-20 bg-background pt-10 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 font-heading">
              {t("home.features.title")}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
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
                  <Card className="h-full hover:shadow-lg transition-smooth">
                    <CardHeader>
                      <div className="bg-primary/10 p-3 rounded-lg inline-block mb-4">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle className="text-xl mb-2">
                        {feature.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{feature.description}</CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="relative z-20 bg-muted/30 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 font-heading">
              {t("home.testimonials.title")}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
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
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star
                          key={i}
                          className="h-4 w-4 fill-primary text-primary"
                        />
                      ))}
                    </div>
                    <CardDescription className="text-base">
                      {testimonial.content}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {testimonial.role}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="relative z-20 bg-background py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 font-heading">
                {t("home.whyChoose.title")}
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
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
                    <span className="text-base">{reason}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: isRTL ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <Card className="p-8">
                <div className="bg-primary/10 p-6 rounded-lg inline-block mb-6">
                  <Shield className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="text-2xl mb-4">
                  {t("home.whyChoose.cardTitle")}
                </CardTitle>
                <CardDescription className="text-base mb-6">
                  {t("home.whyChoose.cardDescription")}
                </CardDescription>
                <Link to="/about">
                  <Button variant="outline" className="w-full sm:w-auto">
                    {t("home.whyChoose.learnMore")}
                  </Button>
                </Link>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-20 bg-linear-to-r from-primary/10 via-primary/5 to-primary/10 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-6 font-heading">
              {t("home.cta.title")}
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t("home.cta.description")}
            </p>
            <div className="flex gap-3 sm:gap-4 justify-center flex-wrap px-2">
              <Link to="/contact" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-primary text-primary-foreground hover:glow-primary"
                >
                  <span className="wrap-break-word">{t("home.cta.contact")}</span>
                </Button>
              </Link>
              <Link to="/about" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <span className="wrap-break-word">{t("home.cta.learnMore")}</span>
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
