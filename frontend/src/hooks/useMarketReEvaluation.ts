import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { reEvaluateMarket } from "@/actions/market.actions";
import { useTranslation } from "react-i18next";

export const useTriggerReEvaluation = () => {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: reEvaluateMarket,
    onSuccess: (data) => {
      // The backend returns a localized message key like "MarketReEvaluationStarted"
      toast.success(t(data.message, "Market re-evaluation has been started in the background."));
    },
    onError: (error: any) => {
      // Handle 403 or other errors
      if (error.response?.status === 403) {
        toast.error(t("Forbidden", "You do not have permission to perform this action."));
      } else {
        toast.error(t("ReEvaluationFailed", "Failed to start market re-evaluation."));
      }
    },
  });
};
