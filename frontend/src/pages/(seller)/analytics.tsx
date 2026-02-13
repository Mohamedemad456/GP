import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from "@gp/design-system";
import {
  Car,
  DollarSign,
  TrendingUp,
  Eye,
  Heart,
  CheckCircle,
  Clock,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
} from "lucide-react";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const monthlyData = [
  { month: "Mar", listed: 2, views: 145, favorites: 12, sold: 1, revenue: 45000 },
  { month: "Apr", listed: 3, views: 210, favorites: 18, sold: 1, revenue: 52000 },
  { month: "May", listed: 2, views: 285, favorites: 24, sold: 2, revenue: 98000 },
  { month: "Jun", listed: 4, views: 340, favorites: 31, sold: 2, revenue: 115000 },
  { month: "Jul", listed: 3, views: 410, favorites: 38, sold: 3, revenue: 168000 },
  { month: "Aug", listed: 2, views: 320, favorites: 28, sold: 1, revenue: 72000 },
  { month: "Sep", listed: 5, views: 520, favorites: 45, sold: 4, revenue: 245000 },
  { month: "Oct", listed: 3, views: 480, favorites: 42, sold: 3, revenue: 198000 },
  { month: "Nov", listed: 4, views: 560, favorites: 52, sold: 3, revenue: 215000 },
  { month: "Dec", listed: 2, views: 380, favorites: 32, sold: 2, revenue: 134000 },
  { month: "Jan", listed: 5, views: 640, favorites: 58, sold: 4, revenue: 312000 },
  { month: "Feb", listed: 3, views: 580, favorites: 48, sold: 3, revenue: 256000 },
];

const statusBreakdown = [
  { status: "active", count: 8, pct: 35, color: "bg-success" },
  { status: "pending", count: 3, pct: 13, color: "bg-warning" },
  { status: "sold", count: 10, pct: 43, color: "bg-info" },
  { status: "rejected", count: 2, pct: 9, color: "bg-destructive" },
];

const topListings = [
  { id: 1, title: "2024 Toyota Camry XLE", views: 342, favorites: 28, status: "active", price: 128000 },
  { id: 2, title: "2023 BMW 330i M Sport", views: 298, favorites: 24, status: "sold", price: 215000 },
  { id: 3, title: "2024 Honda Accord Hybrid", views: 256, favorites: 21, status: "active", price: 142000 },
  { id: 4, title: "2023 Mercedes C200", views: 234, favorites: 19, status: "active", price: 198000 },
  { id: 5, title: "2022 Nissan Patrol V8", views: 212, favorites: 32, status: "sold", price: 285000 },
];

const recentActivity = [
  { action: "viewed", detail: "2024 Toyota Camry XLE", count: 12, time: "2 hours ago" },
  { action: "favorited", detail: "2024 Honda Accord Hybrid", count: 3, time: "5 hours ago" },
  { action: "sold", detail: "2023 BMW 330i M Sport", time: "1 day ago" },
  { action: "approved", detail: "2024 Hyundai Tucson", time: "2 days ago" },
  { action: "rejected", detail: "2021 Ford Explorer", time: "3 days ago" },
  { action: "viewed", detail: "2023 Mercedes C200", count: 8, time: "3 days ago" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat("en-SA", {
  style: "currency",
  currency: "SAR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function fmtCurrency(val: number) {
  return currencyFmt.format(val);
}

function fmtShort(val: number) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return val.toString();
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

const Sparkline = memo(
  ({
    data,
    color = "var(--primary)",
    height = 32,
    width = 100,
  }: {
    data: number[];
    color?: string;
    height?: number;
    width?: number;
  }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const padding = 2;
    const innerH = height - padding * 2;
    const step = (width - padding * 2) / (data.length - 1);

    const points = data.map(
      (v, i) =>
        `${padding + i * step},${padding + innerH - ((v - min) / range) * innerH}`
    );
    const pathD = `M${points.join(" L")}`;
    const areaD = `${pathD} L${padding + (data.length - 1) * step},${height} L${padding},${height} Z`;

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="shrink-0"
      >
        <defs>
          <linearGradient id={`spark-s-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#spark-s-${color.replace(/[^a-z0-9]/gi, "")})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
);
Sparkline.displayName = "Sparkline";

// ─── CSS Bar ─────────────────────────────────────────────────────────────────

const Bar = memo(
  ({
    value,
    max,
    color = "bg-primary",
    height = "h-2",
  }: {
    value: number;
    max: number;
    color?: string;
    height?: string;
  }) => (
    <div className={`w-full ${height} rounded-full bg-muted overflow-hidden`}>
      <div
        className={`${height} rounded-full ${color} transition-all duration-500`}
        style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
      />
    </div>
  )
);
Bar.displayName = "Bar";

// ─── Stat Card ───────────────────────────────────────────────────────────────

const accentStyles = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  destructive: "bg-destructive/10 text-destructive",
} as const;

const StatCard = memo(
  ({
    title,
    value,
    change,
    changeLabel,
    icon: Icon,
    accent = "primary",
    sparkData,
    sparkColor,
  }: {
    title: string;
    value: string;
    change: number;
    changeLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    accent?: keyof typeof accentStyles;
    sparkData?: number[];
    sparkColor?: string;
  }) => {
    const isPositive = change >= 0;

    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardDescription className="text-sm font-medium">{title}</CardDescription>
          <div className={`flex size-9 items-center justify-center rounded-lg ${accentStyles[accent]}`}>
            <Icon className="size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl font-bold font-heading text-foreground">{value}</div>
              <div className="mt-1 flex items-center gap-1 text-xs">
                {isPositive ? (
                  <ArrowUpRight className="size-3.5 text-success" />
                ) : (
                  <ArrowDownRight className="size-3.5 text-destructive" />
                )}
                <span className={isPositive ? "text-success font-medium" : "text-destructive font-medium"}>
                  {isPositive ? "+" : ""}{change}%
                </span>
                <span className="text-muted-foreground">{changeLabel}</span>
              </div>
            </div>
            {sparkData && (
              <Sparkline data={sparkData} color={sparkColor ?? "var(--primary)"} width={80} height={32} />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);
StatCard.displayName = "StatCard";

// ─── Main Page ───────────────────────────────────────────────────────────────

const SellerAnalytics = () => {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const totalListings = monthlyData.reduce((s, d) => s + d.listed, 0);
    const totalViews = monthlyData.reduce((s, d) => s + d.views, 0);
    const totalFavorites = monthlyData.reduce((s, d) => s + d.favorites, 0);
    const totalSold = monthlyData.reduce((s, d) => s + d.sold, 0);
    const totalRevenue = monthlyData.reduce((s, d) => s + d.revenue, 0);

    return { totalListings, totalViews, totalFavorites, totalSold, totalRevenue, activeListings: 8 };
  }, []);

  const sparkViews = useMemo(() => monthlyData.map((d) => d.views), []);
  const sparkFavorites = useMemo(() => monthlyData.map((d) => d.favorites), []);
  const sparkSold = useMemo(() => monthlyData.map((d) => d.sold), []);
  const sparkRevenue = useMemo(() => monthlyData.map((d) => d.revenue), []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {t("seller.analytics.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("seller.analytics.subtitle")}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title={t("seller.analytics.totalListings")}
          value={stats.totalListings.toString()}
          change={15.2}
          changeLabel={t("seller.analytics.vsLastMonth")}
          icon={Car}
          accent="primary"
        />
        <StatCard
          title={t("seller.analytics.activeListings")}
          value={stats.activeListings.toString()}
          change={8.5}
          changeLabel={t("seller.analytics.vsLastMonth")}
          icon={CheckCircle}
          accent="success"
        />
        <StatCard
          title={t("seller.analytics.totalViews")}
          value={fmtShort(stats.totalViews)}
          change={22.1}
          changeLabel={t("seller.analytics.vsLastMonth")}
          icon={Eye}
          accent="info"
          sparkData={sparkViews}
          sparkColor="var(--info)"
        />
        <StatCard
          title={t("seller.analytics.totalFavorites")}
          value={stats.totalFavorites.toString()}
          change={18.7}
          changeLabel={t("seller.analytics.vsLastMonth")}
          icon={Heart}
          accent="destructive"
          sparkData={sparkFavorites}
          sparkColor="var(--destructive)"
        />
        <StatCard
          title={t("seller.analytics.carsSold")}
          value={stats.totalSold.toString()}
          change={12.0}
          changeLabel={t("seller.analytics.vsLastMonth")}
          icon={ShoppingBag}
          accent="warning"
          sparkData={sparkSold}
          sparkColor="var(--warning)"
        />
        <StatCard
          title={t("seller.analytics.totalRevenue")}
          value={fmtCurrency(stats.totalRevenue)}
          change={25.3}
          changeLabel={t("seller.analytics.vsLastMonth")}
          icon={DollarSign}
          accent="success"
          sparkData={sparkRevenue}
          sparkColor="var(--success)"
        />
      </div>

      {/* Monthly Performance + Status Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Monthly Performance Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("seller.analytics.monthlyPerformance")}</CardTitle>
            <CardDescription>{t("seller.analytics.monthlyPerformanceDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              <div className="grid grid-cols-6 gap-2 border-b border-border pb-2 text-xs font-medium text-muted-foreground">
                <span>{t("seller.analytics.month")}</span>
                <span className="text-right">{t("seller.analytics.listed")}</span>
                <span className="text-right">{t("seller.analytics.views")}</span>
                <span className="text-right">{t("seller.analytics.favorites")}</span>
                <span className="text-right">{t("seller.analytics.sold")}</span>
                <span className="text-right">{t("seller.analytics.revenue")}</span>
              </div>
              {monthlyData.map((row, i) => {
                const prevRevenue = i > 0 ? monthlyData[i - 1].revenue : row.revenue;
                const revenueUp = row.revenue >= prevRevenue;
                return (
                  <div
                    key={row.month}
                    className="grid grid-cols-6 gap-2 border-b border-border/50 py-2.5 text-sm last:border-0 hover:bg-muted/30 rounded-sm transition-colors"
                  >
                    <span className="font-medium text-foreground">{row.month}</span>
                    <span className="text-right text-muted-foreground tabular-nums">{row.listed}</span>
                    <span className="text-right text-muted-foreground tabular-nums">{row.views}</span>
                    <span className="text-right text-muted-foreground tabular-nums">{row.favorites}</span>
                    <span className="text-right text-muted-foreground tabular-nums">{row.sold}</span>
                    <span className="text-right tabular-nums flex items-center justify-end gap-1">
                      <span className={revenueUp ? "text-success font-medium" : "text-destructive font-medium"}>
                        {fmtShort(row.revenue)}
                      </span>
                      {revenueUp ? (
                        <ArrowUpRight className="size-3 text-success" />
                      ) : (
                        <ArrowDownRight className="size-3 text-destructive" />
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Listing Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("seller.analytics.listingStatus")}</CardTitle>
            <CardDescription>{t("seller.analytics.listingStatusDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Stacked bar */}
            <div className="flex h-4 w-full overflow-hidden rounded-full">
              {statusBreakdown.map((item) => (
                <div
                  key={item.status}
                  className={`${item.color} transition-all`}
                  style={{ width: `${item.pct}%` }}
                  title={`${item.status}: ${item.count}`}
                />
              ))}
            </div>
            <div className="mt-5 space-y-4">
              {statusBreakdown.map((item) => {
                const statusKey = item.status as "active" | "pending" | "sold" | "rejected";
                const badgeVariant = {
                  active: "success" as const,
                  pending: "warning" as const,
                  sold: "info" as const,
                  rejected: "destructive" as const,
                }[statusKey];

                return (
                  <div key={item.status} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={badgeVariant} className="text-[10px] px-1.5 py-0">
                          {t(`seller.analytics.status.${statusKey}`)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="tabular-nums text-muted-foreground">{item.count}</span>
                        <span className="w-8 text-right tabular-nums font-medium text-foreground">{item.pct}%</span>
                      </div>
                    </div>
                    <Bar value={item.pct} max={100} color={item.color} height="h-1.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Listings + Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Performing Listings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-primary" />
              {t("seller.analytics.topListings")}
            </CardTitle>
            <CardDescription>{t("seller.analytics.topListingsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topListings.map((listing, i) => (
                <div
                  key={listing.id}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{listing.title}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" /> {listing.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="size-3" /> {listing.favorites}
                      </span>
                      <span className="font-medium text-foreground">{fmtCurrency(listing.price)}</span>
                    </div>
                  </div>
                  <Badge
                    variant={listing.status === "active" ? "success" : "info"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {t(`seller.analytics.status.${listing.status}`)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("seller.analytics.recentActivity")}</CardTitle>
            <CardDescription>{t("seller.analytics.recentActivityDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 p-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="mt-0.5">
                    {item.action === "viewed" && <Eye className="size-4 text-info" />}
                    {item.action === "favorited" && <Heart className="size-4 text-destructive" />}
                    {item.action === "sold" && <DollarSign className="size-4 text-success" />}
                    {item.action === "approved" && <CheckCircle className="size-4 text-success" />}
                    {item.action === "rejected" && <XCircle className="size-4 text-destructive" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          item.action === "sold" || item.action === "approved"
                            ? "success"
                            : item.action === "rejected"
                              ? "destructive"
                              : item.action === "favorited"
                                ? "warning"
                                : "info"
                        }
                        className="text-[10px]"
                      >
                        {t(`seller.analytics.activity.${item.action}`)}
                      </Badge>
                      {item.count && (
                        <span className="text-xs text-muted-foreground">+{item.count}</span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-foreground">{item.detail}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("seller.analytics.revenueSummary")}</CardTitle>
          <CardDescription>{t("seller.analytics.revenueSummaryDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
                <DollarSign className="size-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("seller.analytics.totalRevenue")}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-heading text-foreground">
                    {fmtCurrency(stats.totalRevenue)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-info/10">
                <TrendingUp className="size-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("seller.analytics.avgPerSale")}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-heading text-foreground">
                    {fmtCurrency(Math.round(stats.totalRevenue / stats.totalSold))}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-warning/10">
                <Clock className="size-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("seller.analytics.pendingReview")}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-heading text-foreground">3</span>
                  <Badge variant="warning">{t("seller.analytics.awaitingApproval")}</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SellerAnalytics;
