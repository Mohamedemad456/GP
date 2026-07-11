import { useTranslation } from "react-i18next";
import { TrendingUp, AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from "@gp/design-system";
import type { ListingMLMetadata } from "@/types/market-reevaluation";

interface MLMetadataCardProps {
  metadata: ListingMLMetadata;
  currentPrice: number;
}

export const MLMetadataCard = ({ metadata, currentPrice }: MLMetadataCardProps) => {
  const { t } = useTranslation();

  // Show if fair price exists
  if (!metadata.fairPrice) return null;

  // Calculate percentage difference
  const priceDifference = Math.abs(currentPrice - metadata.fairPrice);
  const percentageDifference = (priceDifference / currentPrice) * 100;
  const isSignificant = percentageDifference >= 10;

  return (
    <Card className={`overflow-hidden transition-all duration-200 ${isSignificant ? "border-destructive/50 shadow-sm" : ""}`}>
      <CardHeader className="bg-muted/30 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t("MarketEvaluation", "Market Evaluation")}
          </CardTitle>
          {isSignificant && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t("SignificantChange", "Significant Change")}
            </Badge>
          )}
        </div>
        <CardDescription>
          {t("BasedOnModel", "Based on model version:")} {metadata.modelVersion} • {new Date(metadata.predictedAt || "").toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">{t("FairMarketPrice", "Fair Market Price")}</span>
          <span className={`text-2xl font-bold ${isSignificant ? "text-destructive" : ""}`}>
            ${metadata.fairPrice.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">{t("ConfidenceLevel", "Confidence Level")}</span>
          <span className="text-xl font-semibold capitalize">
            {metadata.confidenceLevel || "N/A"}
          </span>
        </div>
        {(metadata.negotiationRangeLower || metadata.negotiationRangeUpper) && (
          <div className="sm:col-span-2 flex flex-col gap-1 mt-2">
            <span className="text-sm font-medium text-muted-foreground">{t("SuggestedNegotiationRange", "Suggested Negotiation Range")}</span>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                ${metadata.negotiationRangeLower?.toLocaleString()}
              </span>
              <div className="h-1 flex-1 mx-4 rounded-full bg-gradient-to-r from-emerald-400 to-blue-400 opacity-50" />
              <span className="font-medium text-blue-600 dark:text-blue-400">
                ${metadata.negotiationRangeUpper?.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
