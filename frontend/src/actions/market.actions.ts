import { api } from "@/lib/api";
import type { Notification } from "@/types/market-reevaluation";

export const reEvaluateMarket = async (): Promise<{ message: string }> => {
  const response = await api.post("/api/admin/listings/re-evaluate-market");
  return response.data;
};

export const getNotifications = async (): Promise<Notification[]> => {
  const response = await api.get("/api/notifications");
  return response.data;
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
  await api.patch(`/api/notifications/${id}/read`);
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  await api.patch("/api/notifications/read-all");
};
