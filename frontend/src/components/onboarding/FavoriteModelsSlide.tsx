import { useState, useMemo } from "react";
import { Check, Search, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Input,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@gp/design-system";
import { cn } from "@/lib/utils";
import type { FavoriteModelsSlideProps } from "@/types";

const MAX_SELECTIONS = 3;
const INITIAL_COUNT = 15;
const LOAD_MORE_STEP = 15;

const FavoriteModelsSlide = ({ carModels, onSubmit }: FavoriteModelsSlideProps) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return carModels;
    return carModels.filter((c) => c.brand.toLowerCase().includes(q));
  }, [carModels, search]);

  // When searching show all matches; when browsing respect the visible count
  const visible = search.trim() ? filtered : filtered.slice(0, visibleCount);
  const hasMore = !search.trim() && visibleCount < filtered.length;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECTIONS) return prev;
      return [...prev, id];
    });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6 animate-scale-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold font-heading">
            {t("onboarding.favorites.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("onboarding.favorites.subtitle", { count: MAX_SELECTIONS })}
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("onboarding.favorites.searchPlaceholder")}
            className="ps-9 bg-background border-border/70 focus:border-primary transition-smooth"
          />
        </div>

        {/* Grid */}
        {visible.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            {t("onboarding.favorites.noResults")}
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {visible.map((car) => {
              const isSelected = selectedIds.includes(car.id);
              return (
                <Tooltip key={car.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => toggleSelection(car.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 w-full",
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border/60 bg-card/80 hover:border-primary/50 hover:bg-primary/5",
                        selectedIds.length >= MAX_SELECTIONS && !isSelected
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      )}
                    >
                      <div className="relative">
                        {car.logo ? (
                          <img
                            src={car.logo}
                            alt={car.brand}
                            className="h-12 w-12 object-contain rounded-lg"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                            {car.brand.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {isSelected && (
                          <span className="absolute -top-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-center w-full truncate px-0.5 leading-tight">
                        {car.brand}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {car.brand}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((n) => n + LOAD_MORE_STEP)}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4" />
              {t("onboarding.favorites.loadMore", {
                remaining: Math.min(LOAD_MORE_STEP, filtered.length - visibleCount),
              })}
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col gap-4 pt-2 border-t border-border/40">
          <p className="text-center text-sm text-muted-foreground">
            {t("onboarding.favorites.selected", {
              count: selectedIds.length,
              max: MAX_SELECTIONS,
            })}
          </p>
          <Button
            type="button"
            size="lg"
            onClick={() => onSubmit(selectedIds)}
            disabled={selectedIds.length < 1}
            className="w-full bg-primary text-primary-foreground hover:glow-primary transition-smooth disabled:opacity-50"
          >
            {t("onboarding.favorites.continue")}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default FavoriteModelsSlide;
