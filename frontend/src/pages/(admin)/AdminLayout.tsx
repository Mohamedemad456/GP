import { memo, useCallback, useMemo } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { logoutUser } from "@/lib/authApi";
import {
  Users,
  Car,
  House,
  LayoutDashboard,
  BarChart3,
  LogOut,
  Languages,
  Database,
  ActivitySquare,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  Button,
  Separator,
} from "@gp/design-system";

const AdminLayout = memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { clearUser } = useAuth();

  const currentLang = useMemo(
    () => (i18n.language?.startsWith("ar") ? "ar" : "en"),
    [i18n.language],
  );

  const toggleLanguage = useCallback(() => {
    const next = currentLang === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
    try {
      localStorage.setItem("i18nextLng", next);
    } catch {
      /* noop */
    }
  }, [currentLang, i18n]);

  return (
    <SidebarProvider>
      <Sidebar
        collapsible="icon"
        side={currentLang === "ar" ? "right" : "left"}
      >
        <SidebarHeader className="border-sidebar-border border-b h-14 justify-center">
          <div className="flex items-center gap-2 px-2 font-semibold text-sidebar-foreground">
            <LayoutDashboard className="size-5 shrink-0" />
            <span className="truncate">{t("admin.sidebar.title")}</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t("admin.sidebar.overview")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={t("navigation.home")}
                    isActive={location.pathname === "/"}
                  >
                    <NavLink to="/" end>
                      <House className="size-4" />
                      <span>{t("navigation.home")}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={t("admin.sidebar.analytics")}
                    isActive={location.pathname === "/admin"}
                  >
                    <NavLink to="/admin" end>
                      <BarChart3 className="size-4" />
                      <span>{t("admin.sidebar.analytics")}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>
              {t("admin.sidebar.moderation")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {[
                  {
                    label: t("admin.sidebar.users"),
                    icon: Users,
                    to: "/admin/users",
                  },
                  {
                    label: t("admin.sidebar.carsPostsPending"),
                    icon: Car,
                    to: "/admin/cars-pending",
                  },
                  {
                    label: t("admin.sidebar.activityLogs"),
                    icon: ActivitySquare,
                    to: "/admin/activity-logs",
                  },
                ].map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.label}
                      isActive={location.pathname === item.to}
                    >
                      <NavLink to={item.to}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>
              {t("admin.sidebar.dataManagement")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {[
                  {
                    label: t("admin.sidebar.makes"),
                    to: "/admin/makes",
                  },
                  {
                    label: t("admin.sidebar.models"),
                    to: "/admin/models",
                  },
                  {
                    label: t("admin.sidebar.conditions"),
                    to: "/admin/conditions",
                  },
                ].map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.label}
                      isActive={location.pathname === item.to}
                    >
                      <NavLink to={item.to}>
                        <Database className="size-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-sidebar-border border-t">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={t("admin.sidebar.logout")}
                onClick={async () => {
                  try { await logoutUser(); } catch { /* proceed regardless */ }
                  clearUser();
                  navigate("/login", { replace: true });
                }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
                <span>{t("admin.sidebar.logout")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 bg-background">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="font-heading font-semibold text-foreground">
            {t("admin.header.dashboard")}
          </span>
          <div className={currentLang === "en" ? "ml-auto" : "mr-auto"}>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="gap-1.5 text-muted-foreground hover:text-white"
              aria-label="Toggle language"
            >
              <Languages className="size-4" />
              <span className="text-xs font-semibold uppercase">
                {currentLang === "en" ? "AR" : "EN"}
              </span>
            </Button>
          </div>
        </header>
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
});

AdminLayout.displayName = "AdminLayout";

export default AdminLayout;
