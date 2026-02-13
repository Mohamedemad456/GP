import { memo, useCallback, useMemo } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Car, LogOut, Languages, Plus, List } from "lucide-react";
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

const SellerLayout = memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

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
            <Car className="size-5 shrink-0" />
            <span className="truncate">{t("seller.sidebar.title")}</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Overview */}
          <SidebarGroup>
            <SidebarGroupLabel>
              {t("seller.sidebar.overview")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={t("seller.sidebar.analytics")}
                    isActive={location.pathname === "/seller"}
                  >
                    <NavLink to="/seller" end>
                      <BarChart3 className="size-4" />
                      <span>{t("seller.sidebar.analytics")}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Listings Management */}
          <SidebarGroup>
            <SidebarGroupLabel>{t("seller.sidebar.manage")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={t("seller.sidebar.myListings")}
                    isActive={location.pathname === "/seller/listings"}
                  >
                    <NavLink to="/seller/listings">
                      <List className="size-4" />
                      <span>{t("seller.sidebar.myListings")}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={t("seller.sidebar.addListing")}
                    isActive={location.pathname === "/seller/add-listing"}
                  >
                    <NavLink to="/seller/add-listing">
                      <Plus className="size-4" />
                      <span>{t("seller.sidebar.addListing")}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-sidebar-border border-t">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={t("seller.sidebar.logout")}
                onClick={() => {
                  navigate("/login");
                }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
                <span>{t("seller.sidebar.logout")}</span>
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
            {t("seller.header.dashboard")}
          </span>
          <div className={currentLang === "en" ? "ml-auto" : "mr-auto"}>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
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

SellerLayout.displayName = "SellerLayout";

export default SellerLayout;
