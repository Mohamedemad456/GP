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
  PageLoader,
} from "@gp/design-system";
import { Car, Heart, Trash2 } from "lucide-react";
import { type BuyerListingDto } from "@/lib/listingsApi";
import { getFavorites, removeFavorite } from "@/lib/favoritesApi";
import { toast } from "sonner";

export default function FavoritesPage() {
  const { t, i18n } = useTranslation();
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

  const [favorites, setFavorites] = useState<BuyerListingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const BASE_URL: string =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5082";

  function resolvePhotoUrl(url: string | null): string | null {
    if (!url) return null;
    if (url.startsWith("http") || url.startsWith("data:")) return url;
    const path = url.startsWith("/") ? url : `/${url}`;
    return `${BASE_URL}${path}`;
  }

  const fetchFavorites = useCallback(() => {
    setIsLoading(true);
    getFavorites({ pageSize: 100 })
      .then((res) => {
        if (res.success && res.data) {
          setFavorites(res.data.data);
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error(t("favorites.fetchError", "Failed to load favorites"));
      })
      .finally(() => setIsLoading(false));
  }, [t]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleRemoveFavorite = async (id: string) => {
    try {
      const res = await removeFavorite(id);
      if (res.success) {
        setFavorites((prev) => prev.filter((car) => String(car.id) !== id));
        toast.success(t("favorites.removedSuccess", "Removed from favorites"));
      } else {
        toast.error(res.message || "Failed to remove favorite");
      }
    } catch (err) {
      toast.error("Failed to remove favorite");
    }
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pt-20 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <Heart className="size-6 text-primary fill-primary" />
          {t("navigation.favorites", "My Favorites")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("favorites.subtitle", "Cars you have saved for later")}
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-card py-16 text-center">
          <div className="rounded-full bg-muted p-4">
            <Heart className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              {t("favorites.noFavorites", "No favorites yet")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("favorites.noFavoritesDesc", "Start exploring and save cars you love.")}
            </p>
          </div>
          <Link to="/feed">
            <Button variant="outline" size="sm">
              {t("favorites.browseFeed", "Browse Feed")}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {favorites.map((listing) => {
            const imageUrl = resolvePhotoUrl(listing.primaryPhotoUrl);

            return (
              <Card key={listing.id} className="group overflow-hidden flex flex-col">
                <div className="overflow-hidden relative">
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
                  <button
                    onClick={() => handleRemoveFavorite(String(listing.id))}
                    className="absolute top-3 end-3 rounded-full p-2 bg-background/80 backdrop-blur-sm border border-border/50 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <CardHeader className="space-y-2 flex-grow">
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
                <CardContent className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("buyer.feed.listingPrice", "Price")}
                      </p>
                      <p className="font-heading text-xl font-bold text-primary">
                        {listing.listingPrice !== null ? currency.format(listing.listingPrice) : "N/A"}
                      </p>
                    </div>
                  </div>
                  <Link to={`/cars/${listing.id}`} className="block">
                    <Button className="w-full">
                      {t("buyer.feed.viewDetails", "View Details")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
