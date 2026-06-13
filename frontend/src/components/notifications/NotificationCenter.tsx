import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Button,
  Badge,
} from "@gp/design-system";
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from "@/hooks/useNotifications";

export const NotificationCenter = () => {
  const { t } = useTranslation();
  const { data: notifications = [], isLoading } = useNotifications();
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();

  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent closing dropdown if they just mark as read
    e.stopPropagation();
    markAsReadMutation.mutate(id);
  };

  const handleMarkAllAsRead = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    markAllAsReadMutation.mutate();
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t("Notifications")}</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-auto p-0 text-xs text-muted-foreground"
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              {t("MarkAllAsRead", "Mark all as read")}
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("Loading", "Loading...")}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("NoNotifications", "No notifications")}
            </div>
          ) : (
            notifications.map((notification) => {
              const isSignificantChange = notification.title.toLowerCase().includes("significant");

              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${
                    !notification.isRead ? "bg-muted/50" : ""
                  }`}
                  asChild
                >
                  <Link
                    to={notification.listingId ? `/my-listings?highlight=${notification.listingId}` : "#"}
                    onClick={() => {
                      if (!notification.isRead) {
                        markAsReadMutation.mutate(notification.id);
                      }
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex w-full justify-between gap-2">
                      <span className={`font-medium ${isSignificantChange ? "text-destructive" : ""}`}>
                        {notification.title}
                      </span>
                      {!notification.isRead && (
                        <div
                          className="h-2 w-2 mt-1.5 rounded-full bg-primary flex-shrink-0"
                          title={t("Unread", "Unread")}
                        />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 mt-1">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </span>
                  </Link>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
