import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Car, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { RoleSlide, FavoriteModelsSlide } from "@/components/onboarding";
import { OnboardingRole } from "@/types";
import { MOCK_CAR_MODELS } from "@/data/mocks/cars";

const Onboarding = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<OnboardingRole | null>(null);

  const handleRoleSelect = (selectedRole: OnboardingRole) => {
    setRole(selectedRole);
    if (selectedRole === OnboardingRole.Seller) {
      navigate("/", { replace: true });
    } else {
      setStep(2);
    }
  };

  const handleSkip = () => {
    navigate("/", { replace: true });
  };

  const handleFavoritesSubmit = (selectedIds: string[]) => {
    // TODO: Persist selectedIds to API or localStorage when backend is ready
    console.log("Selected favorite car models:", selectedIds);
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

          <div className="flex justify-center gap-2 mb-8">
            <span
              className={`h-1.5 w-12 rounded-full transition-colors ${
                step === 1 ? "bg-primary" : "bg-primary/30"
              }`}
            />
            <span
              className={`h-1.5 w-12 rounded-full transition-colors ${
                step === 2 ? "bg-primary" : "bg-muted"
              }`}
            />
          </div>

          {step === 1 && (
            <RoleSlide onSelect={handleRoleSelect} onSkip={handleSkip} />
          )}

          {step === 2 && role === OnboardingRole.Buyer && (
            <FavoriteModelsSlide
              carModels={MOCK_CAR_MODELS}
              onSubmit={handleFavoritesSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
