import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, AlertCircle } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@gp/design-system";
import { useTriggerReEvaluation } from "@/hooks/useMarketReEvaluation";

export default function ReEvaluationPage() {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const reEvaluateMutation = useTriggerReEvaluation();

  const handleConfirm = () => {
    reEvaluateMutation.mutate(undefined, {
      onSuccess: () => {
        setIsDialogOpen(false);
      }
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("MarketReEvaluation", "Market Re-Evaluation")}</h1>
        <p className="text-muted-foreground">
          {t("ReEvaluationDescription", "Trigger a background job to re-evaluate all listings via the ML model. This will update the Fair Price, Negotiation Ranges, and other ML metadata for all active listings.")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {t("ControlPanel", "Control Panel")}
          </CardTitle>
          <CardDescription>
            {t("ControlPanelDesc", "Manually trigger the market re-evaluation process.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 border border-border/50 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-sm">
                  {t("WarningSignificantChanges", "Warning: Significant Changes")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("WarningSignificantChangesDesc", "This operation will scan all listings. Sellers will be automatically notified if their listing's fair price changes by 10% or more.")}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <Button 
                size="lg" 
                variant="outline"
                asChild
              >
                <a href="http://localhost:8502" target="_blank" rel="noopener noreferrer">
                  {t("MLDashboard", "ML Dashboard")}
                </a>
              </Button>
              <Button 
                size="lg" 
                onClick={() => setIsDialogOpen(true)}
                disabled={reEvaluateMutation.isPending}
              >
                {reEvaluateMutation.isPending 
                  ? t("Starting", "Starting...") 
                  : t("ReEvaluateMarketButton", "Re-Evaluate Market")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ConfirmReEvaluation", "Confirm Market Re-Evaluation")}</DialogTitle>
            <DialogDescription className="py-4 space-y-2">
              <p>
                {t("ConfirmReEvaluationMessage", "Are you sure you want to trigger a full market re-evaluation?")}
              </p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                <li>{t("WillRunInBackground", "This process will run in the background.")}</li>
                <li>{t("WillNotModifyListingPrice", "It will never modify the seller's original Listing Price.")}</li>
                <li>{t("WillNotifySellers", "It will notify sellers of significant changes.")}</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={reEvaluateMutation.isPending}>
              {t("Cancel", "Cancel")}
            </Button>
            <Button onClick={handleConfirm} disabled={reEvaluateMutation.isPending}>
              {reEvaluateMutation.isPending ? t("Confirming", "Confirming...") : t("ConfirmAndStart", "Confirm and Start")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
