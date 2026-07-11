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
  Users,
  Car,
  DollarSign,
  TrendingUp,
  Eye,
  Clock,
  CheckCircle,
  ShieldCheck,
  Fuel,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const monthlyData = [
  { month: "Mar", users: 45, listings: 32, sold: 18, revenue: 245000 },
  { month: "Apr", users: 62, listings: 45, sold: 25, revenue: 342000 },
  { month: "May", users: 78, listings: 58, sold: 32, revenue: 456000 },
  { month: "Jun", users: 95, listings: 72, sold: 41, revenue: 578000 },
  { month: "Jul", users: 110, listings: 85, sold: 48, revenue: 672000 },
  { month: "Aug", users: 88, listings: 68, sold: 38, revenue: 523000 },
  { month: "Sep", users: 120, listings: 92, sold: 55, revenue: 765000 },
  { month: "Oct", users: 135, listings: 105, sold: 62, revenue: 856000 },
  { month: "Nov", users: 142, listings: 112, sold: 68, revenue: 934000 },
  { month: "Dec", users: 98, listings: 78, sold: 45, revenue: 612000 },
  { month: "Jan", users: 155, listings: 125, sold: 75, revenue: 1045000 },
  { month: "Feb", users: 168, listings: 138, sold: 82, revenue: 1128000 },
];

const topMakes = [
  { make: "Toyota", listings: 186, sold: 142, pct: 100 },
  { make: "Honda", listings: 145, sold: 108, pct: 78 },
  { make: "BMW", listings: 98, sold: 65, pct: 53 },
  { make: "Mercedes", listings: 92, sold: 58, pct: 49 },
  { make: "Nissan", listings: 88, sold: 72, pct: 47 },
  { make: "Hyundai", listings: 76, sold: 61, pct: 41 },
  { make: "Kia", listings: 65, sold: 52, pct: 35 },
];

const fuelBreakdown = [
  { type: "Gasoline", count: 425, pct: 51, color: "bg-chart-1" },
  { type: "Diesel", count: 182, pct: 22, color: "bg-chart-2" },
  { type: "Hybrid", count: 134, pct: 16, color: "bg-chart-3" },
  { type: "Electric", count: 68, pct: 8, color: "bg-chart-4" },
  { type: "Other", count: 21, pct: 3, color: "bg-chart-5" },
];

const conditionGrades = [
  { grade: "A+", count: 85, pct: 10, color: "bg-success" },
  { grade: "A", count: 195, pct: 24, color: "bg-success/80" },
  { grade: "A-", count: 142, pct: 17, color: "bg-success/60" },
  { grade: "B+", count: 178, pct: 21, color: "bg-info" },
  { grade: "B", count: 134, pct: 16, color: "bg-info/70" },
  { grade: "C+", count: 68, pct: 8, color: "bg-warning" },
  { grade: "C", count: 28, pct: 4, color: "bg-warning/70" },
];

const recentActivity = [
  { action: "approved", type: "listing", detail: "2024 Toyota Camry", time: "2 min ago", by: "Admin" },
  { action: "rejected", type: "user", detail: "suspicious-email@test.com", time: "8 min ago", by: "Admin" },
  { action: "approved", type: "user", detail: "ahmed.k@email.com", time: "15 min ago", by: "Admin" },
  { action: "approved", type: "listing", detail: "2023 Honda Accord Hybrid", time: "22 min ago", by: "Admin" },
  { action: "sold", type: "listing", detail: "2022 BMW 330i M Sport", time: "1 hour ago", by: "System" },
  { action: "approved", type: "listing", detail: "2024 Nissan Patrol V8", time: "2 hours ago", by: "Admin" },
  { action: "approved", type: "user", detail: "sara.h@email.com", time: "3 hours ago", by: "Admin" },
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

// ─── Sparkline (pure inline SVG, ~0.2ms render) ─────────────────────────────
// A tiny static SVG path — no library, no resize observer, no overhead.

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
          <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path
          d={areaD}
          fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, "")})`}
        />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
);
Sparkline.displayName = "Sparkline";

// ─── CSS Bar (renders in microseconds) ───────────────────────────────────────

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
          <CardDescription className="text-sm font-medium">
            {title}
          </CardDescription>
          <div
            className={`flex size-9 items-center justify-center rounded-lg ${accentStyles[accent]}`}
          >
            <Icon className="size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl font-bold font-heading text-foreground">
                {value}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs">
                {isPositive ? (
                  <ArrowUpRight className="size-3.5 text-success" />
                ) : (
                  <ArrowDownRight className="size-3.5 text-destructive" />
                )}
                <span
                  className={
                    isPositive
                      ? "text-success font-medium"
                      : "text-destructive font-medium"
                  }
                >
                  {isPositive ? "+" : ""}
                  {change}%
                </span>
                <span className="text-muted-foreground">{changeLabel}</span>
              </div>
            </div>
            {sparkData && (
              <Sparkline
                data={sparkData}
                color={sparkColor ?? "var(--primary)"}
                width={80}
                height={32}
              />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);
StatCard.displayName = "StatCard";

// ─── Action badge helpers ────────────────────────────────────────────────────

function actionBadge(action: string, t: (key: string) => string) {
  switch (action) {
    case "approved":
      return <Badge variant="success">{t("admin.analytics.approved")}</Badge>;
    case "rejected":
      return <Badge variant="destructive">{t("admin.analytics.rejected")}</Badge>;
    case "sold":
      return <Badge variant="info">{t("admin.analytics.sold")}</Badge>;
    default:
      return <Badge variant="secondary">{action}</Badge>;
  }
}

function typeBadge(type: string, t: (key: string) => string) {
  switch (type) {
    case "listing":
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Car className="size-3" /> {t("admin.analytics.listing")}
        </span>
      );
    case "user":
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3" /> {t("admin.analytics.user")}
        </span>
      );
    default:
      return <span className="text-xs text-muted-foreground">{type}</span>;
  }
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const Analytics = () => {
  const { t } = useTranslation();
  const stats = useMemo(() => {
    const totalUsers = monthlyData.reduce((s, d) => s + d.users, 0);
    const totalListings = monthlyData.reduce((s, d) => s + d.listings, 0);
    const totalSold = monthlyData.reduce((s, d) => s + d.sold, 0);
    const totalRevenue = monthlyData.reduce((s, d) => s + d.revenue, 0);

    return {
      totalUsers,
      totalListings,
      totalSold,
      totalRevenue,
      pendingUsers: 23,
      pendingListings: 5,
      approvalRate: 88,
      totalViews: 48520,
    };
  }, []);

  const sparkUsers = useMemo(
    () => monthlyData.map((d) => d.users),
    []
  );
  const sparkListings = useMemo(
    () => monthlyData.map((d) => d.listings),
    []
  );
  const sparkSold = useMemo(
    () => monthlyData.map((d) => d.sold),
    []
  );
  const sparkRevenue = useMemo(
    () => monthlyData.map((d) => d.revenue),
    []
  );

  const maxMakeListings = topMakes[0].listings;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {t("admin.analytics.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.analytics.subtitle")}
        </p>
      </div>

      {/* KPI Cards with sparklines */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("admin.analytics.totalUsers")}
          value={stats.totalUsers.toLocaleString()}
          change={12.5}
          changeLabel={t("admin.analytics.vsLastMonth")}
          icon={Users}
          accent="primary"
          sparkData={sparkUsers}
          sparkColor="var(--primary)"
        />
        <StatCard
          title={t("admin.analytics.carListings")}
          value={stats.totalListings.toLocaleString()}
          change={18.3}
          changeLabel={t("admin.analytics.vsLastMonth")}
          icon={Car}
          accent="info"
          sparkData={sparkListings}
          sparkColor="var(--info)"
        />
        <StatCard
          title={t("admin.analytics.carsSold")}
          value={stats.totalSold.toLocaleString()}
          change={9.4}
          changeLabel={t("admin.analytics.vsLastMonth")}
          icon={DollarSign}
          accent="success"
          sparkData={sparkSold}
          sparkColor="var(--success)"
        />
        <StatCard
          title={t("admin.analytics.totalRevenue")}
          value={fmtCurrency(stats.totalRevenue)}
          change={22.1}
          changeLabel={t("admin.analytics.vsLastMonth")}
          icon={TrendingUp}
          accent="warning"
          sparkData={sparkRevenue}
          sparkColor="var(--warning)"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("admin.analytics.pendingUsers")}
          value={stats.pendingUsers.toString()}
          change={-8.2}
          changeLabel={t("admin.analytics.queueShrinking")}
          icon={Clock}
          accent="warning"
        />
        <StatCard
          title={t("admin.analytics.pendingListings")}
          value={stats.pendingListings.toString()}
          change={-5.1}
          changeLabel={t("admin.analytics.queueShrinking")}
          icon={Clock}
          accent="warning"
        />
        <StatCard
          title={t("admin.analytics.approvalRate")}
          value={`${stats.approvalRate}%`}
          change={2.1}
          changeLabel={t("admin.analytics.vsLastMonth")}
          icon={ShieldCheck}
          accent="success"
        />
        <StatCard
          title={t("admin.analytics.totalViews")}
          value={stats.totalViews.toLocaleString()}
          change={15.8}
          changeLabel={t("admin.analytics.vsLastMonth")}
          icon={Eye}
          accent="info"
        />
      </div>

      {/* Monthly Breakdown Table + Top Makes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Monthly Overview */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t("admin.analytics.monthlyOverview")}</CardTitle>
            <CardDescription>
              {t("admin.analytics.monthlyOverviewDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {/* Table header */}
              <div className="grid grid-cols-5 gap-2 border-b border-border pb-2 text-xs font-medium text-muted-foreground">
                <span>{t("admin.analytics.month")}</span>
                <span className="text-right">{t("admin.analytics.users")}</span>
                <span className="text-right">{t("admin.analytics.listings")}</span>
                <span className="text-right">{t("admin.analytics.sold")}</span>
                <span className="text-right">{t("admin.analytics.revenue")}</span>
              </div>
              {/* Table rows */}
              {monthlyData.map((row, i) => {
                const prevRevenue = i > 0 ? monthlyData[i - 1].revenue : row.revenue;
                const revenueUp = row.revenue >= prevRevenue;
                return (
                  <div
                    key={row.month}
                    className="grid grid-cols-5 gap-2 border-b border-border/50 py-2.5 text-sm last:border-0 hover:bg-muted/30 rounded-sm transition-colors"
                  >
                    <span className="font-medium text-foreground">
                      {row.month}
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">
                      {row.users}
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">
                      {row.listings}
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">
                      {row.sold}
                    </span>
                    <span className="text-right tabular-nums flex items-center justify-end gap-1">
                      <span
                        className={
                          revenueUp
                            ? "text-success font-medium"
                            : "text-destructive font-medium"
                        }
                      >
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

        {/* Top Makes with CSS bars */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("admin.analytics.topCarMakes")}</CardTitle>
            <CardDescription>{t("admin.analytics.topCarMakesDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topMakes.map((item) => (
                <div key={item.make} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {item.make}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.listings} {t("admin.analytics.listed")}</span>
                      <span className="text-success font-medium">
                        {item.sold} {t("admin.analytics.sold")}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="flex-1">
                      <Bar
                        value={item.listings}
                        max={maxMakeListings}
                        color="bg-primary/70"
                        height="h-1.5"
                      />
                    </div>
                    <div className="flex-1">
                      <Bar
                        value={item.sold}
                        max={maxMakeListings}
                        color="bg-success/70"
                        height="h-1.5"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary/70" />
                  {t("admin.analytics.listings")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-success/70" />
                  {t("admin.analytics.sold")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fuel Types + Condition Grades + Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Fuel Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Fuel className="size-4 text-primary" />
              {t("admin.analytics.fuelTypeBreakdown")}
            </CardTitle>
            <CardDescription>
              {t("admin.analytics.fuelTypeBreakdownDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Stacked bar */}
            <div className="flex h-4 w-full overflow-hidden rounded-full">
              {fuelBreakdown.map((item) => (
                <div
                  key={item.type}
                  className={`${item.color} transition-all`}
                  style={{ width: `${item.pct}%` }}
                  title={`${item.type}: ${item.count}`}
                />
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {fuelBreakdown.map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${item.color}`} />
                    <span className="text-sm text-foreground">{item.type}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="tabular-nums text-muted-foreground">
                      {item.count}
                    </span>
                    <span className="w-8 text-right tabular-nums font-medium text-foreground">
                      {item.pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Condition Grades */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="size-4 text-success" />
              {t("admin.analytics.conditionGrades")}
            </CardTitle>
            <CardDescription>
              {t("admin.analytics.conditionGradesDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {conditionGrades.map((item) => (
                <div key={item.grade} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          item.grade.startsWith("A")
                            ? "success"
                            : item.grade.startsWith("B")
                              ? "info"
                              : "warning"
                        }
                        className="w-8 justify-center text-[10px] px-1 py-0"
                      >
                        {item.grade}
                      </Badge>
                      <span className="text-muted-foreground tabular-nums">
                        {item.count} {t("admin.analytics.cars")}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      {item.pct}%
                    </span>
                  </div>
                  <Bar
                    value={item.pct}
                    max={100}
                    color={
                      item.grade.startsWith("A")
                        ? "bg-success"
                        : item.grade.startsWith("B")
                          ? "bg-info"
                          : "bg-warning"
                    }
                    height="h-1.5"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.analytics.recentActivity")}</CardTitle>
            <CardDescription>{t("admin.analytics.recentActivityDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 p-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="mt-0.5">
                    {item.action === "approved" ? (
                      <CheckCircle className="size-4 text-success" />
                    ) : item.action === "rejected" ? (
                      <span className="flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                        !
                      </span>
                    ) : (
                      <DollarSign className="size-4 text-info" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {actionBadge(item.action, t)}
                      {typeBadge(item.type, t)}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-foreground">
                      {item.detail}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Moderation Queue Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.analytics.moderationQueue")}</CardTitle>
          <CardDescription>
            {t("admin.analytics.moderationQueueDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-warning/10">
                <Users className="size-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("admin.analytics.pendingUsers")}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-heading text-foreground">
                    {stats.pendingUsers}
                  </span>
                  <Badge variant="warning">{t("admin.analytics.needsReview")}</Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-warning/10">
                <Car className="size-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("admin.analytics.pendingListings")}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-heading text-foreground">
                    {stats.pendingListings}
                  </span>
                  <Badge variant="warning">{t("admin.analytics.needsReview")}</Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle className="size-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("admin.analytics.approvalRate")}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-heading text-foreground">
                    {stats.approvalRate}%
                  </span>
                  <Badge variant="success">{t("admin.analytics.healthy")}</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
