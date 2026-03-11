import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Separator,
} from "@gp/design-system";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  User,
  Mail,
  Phone,
  MessageCircle,
  Shield,
  Calendar,
  LayoutDashboard,
  ShieldCheck,
  Rss,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getProfile, type UserDto } from "@/lib/authApi";

export default function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [details, setDetails] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((res) => { if (!cancelled && res.success) setDetails(res.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const createdAt = details?.createdAt
    ? new Date(details.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pt-20 pb-12 sm:px-6">

      {/* Page header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
          {t("profile.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("profile.subtitle")}
        </p>
      </div>

      {/* Identity card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3">

            {/* Avatar + badges row */}
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="capitalize">
                  {user?.role ?? "—"}
                </Badge>
                {details?.isActive && (
                  <Badge className="border-green-500/30 bg-green-500/15 text-green-600">
                    {t("profile.active")}
                  </Badge>
                )}
              </div>
            </div>

            {/* Name / email always on their own line */}
            <div>
              <p className="text-lg font-semibold text-foreground">
                {user?.name ?? "—"}
              </p>
              <p className="break-all text-sm text-muted-foreground">
                {user?.email ?? "—"}
              </p>
            </div>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-5">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileField
                icon={<User className="h-4 w-4" />}
                label={t("profile.fields.fullName")}
                value={details?.name}
              />
              <ProfileField
                icon={<User className="h-4 w-4" />}
                label={t("profile.fields.username")}
                value={details?.userName}
              />
              <ProfileField
                icon={<Mail className="h-4 w-4" />}
                label={t("profile.fields.email")}
                value={details?.email}
              />
              <ProfileField
                icon={<Phone className="h-4 w-4" />}
                label={t("profile.fields.phone")}
                value={details?.phoneNumber}
              />
              <ProfileField
                icon={<MessageCircle className="h-4 w-4" />}
                label={t("profile.fields.whatsapp")}
                value={details?.whatsAppNumber}
              />
              <ProfileField
                icon={<Shield className="h-4 w-4" />}
                label={t("profile.fields.roles")}
                value={details?.roles.map((r) => r.toLowerCase()).join(", ")}
              />
              <ProfileField
                icon={<Calendar className="h-4 w-4" />}
                label={t("profile.fields.memberSince")}
                value={createdAt}
              />
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Quick-nav actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => navigate("/feed")}
        >
          <Rss className="h-4 w-4" />
          {t("profile.actions.goToFeed")}
        </Button>

        {user?.role === "user" && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => navigate("/seller")}
          >
            <LayoutDashboard className="h-4 w-4" />
            {t("profile.actions.sellerDashboard")}
          </Button>
        )}

        {user?.role === "admin" && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => navigate("/admin")}
          >
            <ShieldCheck className="h-4 w-4" />
            {t("profile.actions.adminDashboard")}
          </Button>
        )}
      </div>
    </div>
  );
}

type ProfileFieldProps = {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  className?: string;
};

function ProfileField({ icon, label, value, className = "" }: ProfileFieldProps) {
  if (!value) return null;
  return (
    <div className={`flex flex-col gap-1 rounded-lg bg-muted/40 px-4 py-3 ${className}`}>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="break-words text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}
