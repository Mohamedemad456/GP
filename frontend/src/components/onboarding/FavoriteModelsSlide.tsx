import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@gp/design-system";
import { cn } from "@/lib/utils";
import type { FavoriteModelsSlideProps } from "@/types";

const MAX_SELECTIONS = 3;

const FavoriteModelsSlide = ({ carModels, onSubmit }: FavoriteModelsSlideProps) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= MAX_SELECTIONS) return prev;
      return [...prev, id];
    });
  };

  const handleSubmit = () => {
    onSubmit(selectedIds);
  };

  const canSubmit = selectedIds.length >= 1;

  return (
    <div className="space-y-6 animate-scale-in">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold font-heading">
          {t("onboarding.favorites.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("onboarding.favorites.subtitle", { count: MAX_SELECTIONS })}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {carModels.map((car) => {
          const isSelected = selectedIds.includes(car.id);
          return (
            <button
              key={car.id}
              type="button"
              onClick={() => toggleSelection(car.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border/60 bg-card/80 hover:border-primary/50 hover:bg-primary/5"
              )}
            >
              <div className="relative">
                <img
                  src={car.logo}
                  alt={car.brand}
                  className="h-14 w-14 object-contain rounded-lg"
                />
                {isSelected && (
                  <span className="absolute -top-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-center line-clamp-1">
                {car.brand} {car.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 pt-4">
        <p className="text-center text-sm text-muted-foreground">
          {t("onboarding.favorites.selected", {
            count: selectedIds.length,
            max: MAX_SELECTIONS,
          })}
        </p>
        <Button
          type="button"
          size="lg"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full bg-primary text-primary-foreground hover:glow-primary transition-smooth disabled:opacity-50"
        >
          {t("onboarding.favorites.continue")}
        </Button>
      </div>
    </div>
  );
};

export default FavoriteModelsSlide;
