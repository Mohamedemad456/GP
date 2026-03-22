import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Car, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@gp/design-system";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { FavoriteModelsSlide } from "@/components/onboarding";
import { getActiveMakes, getMakeLogoUrl } from "@/lib/makesApi";
import { getProfile } from "@/lib/authApi";
import { useAuth } from "@/context/AuthContext";
import type { CarModel } from "@/data/mocks/cars";
import type { UserRole } from "@/lib/auth";

const Onboarding = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setUser } = useAuth();

  const [makes, setMakes] = useState<CarModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Establish the auth session if the user just registered (signup navigates
  // here before calling setUser to avoid a GuestRoute redirect conflict).
  useEffect(() => {
    getProfile()
      .then((res) => {
        if (res.success) {
          const u = res.data;
          const role = (
            u.roles.map((r) => r.toLowerCase()).includes("admin") ? "admin" : "user"
          ) as UserRole;
          setUser({ userId: u.userId, name: u.name, email: u.email, role });
        }
      })
      .catch(() => {
        // User may not be authenticated (e.g. direct URL visit) — that's fine,
        // onboarding is accessible without auth.
      });
  }, [setUser]);

  useEffect(() => {
    getActiveMakes()
      .then((res) => {
        if (res.success) {
          setMakes(
            res.data.map((m) => ({
              id: m.id,
              brand: m.name,
              name: "",
              logo: getMakeLogoUrl(m.logoUrl),
            })),
          );
        }
      })
      .catch(() => {
        // Falls back to empty list — user can still skip onboarding
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleFavoritesSubmit = (selectedIds: string[]) => {
    // TODO: Persist selectedIds to the user preferences API when endpoint is ready
    console.log("Selected favorite makes:", selectedIds);
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 hero-gradient py-12">
      <div className="fixed top-6 right-6 z-20">
        <LanguageSwitcher />
      </div>
      <Link
        to="/"
        className="fixed top-6 left-6 z-20 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-fast group"
      >
        <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-smooth" />
        <span>{t("auth.backToHome")}</span>
      </Link>

      <div className="w-full max-w-2xl">
        <div className="bg-card/95 p-8 rounded-2xl border border-border/60 shadow-xl">
          <div className="flex justify-center mb-6">
            <div className="bg-primary p-3 rounded-2xl shadow-sm">
              <Car className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <Skeleton className="h-8 w-64 mx-auto" />
                <Skeleton className="h-4 w-80 mx-auto" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            </div>
          ) : (
            <FavoriteModelsSlide
              carModels={makes}
              onSubmit={handleFavoritesSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
