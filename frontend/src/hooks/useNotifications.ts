import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/actions/market.actions";
import type { Notification } from "@/types/market-reevaluation";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"];

export const useNotifications = () => {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: getNotifications,
    refetchInterval: 30000, // Poll every 30 seconds
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: markNotificationAsRead,
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });

      // Snapshot the previous value
      const previousNotifications = queryClient.getQueryData<Notification[]>(NOTIFICATIONS_QUERY_KEY);

      // Optimistically update to the new value
      if (previousNotifications) {
        queryClient.setQueryData<Notification[]>(
          NOTIFICATIONS_QUERY_KEY,
          previousNotifications.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
      }

      // Return a context object with the snapshotted value
      return { previousNotifications };
    },
    onError: (err, newTodo, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousNotifications) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previousNotifications);
      }
      toast.error(t("NotificationUpdateFailed", "Failed to mark notification as read."));
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
};

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previousNotifications = queryClient.getQueryData<Notification[]>(NOTIFICATIONS_QUERY_KEY);

      if (previousNotifications) {
        queryClient.setQueryData<Notification[]>(
          NOTIFICATIONS_QUERY_KEY,
          previousNotifications.map((n) => ({ ...n, isRead: true }))
        );
      }

      return { previousNotifications };
    },
    onError: (err, variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previousNotifications);
      }
      toast.error(t("NotificationUpdateFailed", "Failed to mark all as read."));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
};
