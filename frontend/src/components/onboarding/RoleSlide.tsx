import { ShoppingBag, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OnboardingRole, type RoleSlideProps } from "@/types";

const RoleSlide = ({ onSelect, onSkip }: RoleSlideProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-8 animate-scale-in">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold font-heading">
          {t("onboarding.role.title")}
        </h2>
        <p className="text-muted-foreground">{t("onboarding.role.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onSelect(OnboardingRole.Buyer)}
          className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-border/60 bg-card/80 hover:border-primary hover:bg-primary/5 transition-all duration-200 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 group"
        >
          <div className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <ShoppingBag className="h-12 w-12 text-primary" />
          </div>
          <span className="text-lg font-semibold">{t("onboarding.role.buyer")}</span>
          <span className="text-sm text-muted-foreground text-center">
            {t("onboarding.role.buyerDesc")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelect(OnboardingRole.Seller)}
          className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-border/60 bg-card/80 hover:border-primary hover:bg-primary/5 transition-all duration-200 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 group"
        >
          <div className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Store className="h-12 w-12 text-primary" />
          </div>
          <span className="text-lg font-semibold">{t("onboarding.role.seller")}</span>
          <span className="text-sm text-muted-foreground text-center">
            {t("onboarding.role.sellerDesc")}
          </span>
        </button>
      </div>

      {onSkip && (
        <div className="text-center">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            {t("onboarding.skip")}
          </button>
        </div>
      )}
    </div>
  );
};

export default RoleSlide;
