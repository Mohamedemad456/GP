import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
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
  Pencil,
  X,
  Check,
  Lock,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getProfile, updateProfile, changePassword, type UserDto } from "@/lib/authApi";
import type { UserRole } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

export default function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { success, error: toastError } = useToast();

  // ── profile data ────────────────────────────────────
  const [details, setDetails] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // ── edit-profile state ───────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    userName: "",
    phoneNumber: "",
    whatsAppNumber: "",
  });

  // ── change-password state ────────────────────────────
  const [pwForm, setPwForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPw, setIsChangingPw] = useState(false);

  const loadProfile = () => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(false);
    getProfile()
      .then((res) => {
        if (!cancelled && res.success) {
          setDetails(res.data);
          setForm({
            name: res.data.name ?? "",
            userName: res.data.userName ?? "",
            phoneNumber: res.data.phoneNumber ?? "",
            whatsAppNumber: res.data.whatsAppNumber ?? "",
          });
        }
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; }; // used by useEffect for cleanup
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadProfile, []);

  // ── edit-profile handlers ────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleCancel = () => {
    setForm({
      name: details?.name ?? "",
      userName: details?.userName ?? "",
      phoneNumber: details?.phoneNumber ?? "",
      whatsAppNumber: details?.whatsAppNumber ?? "",
    });
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateProfile({
        name: form.name,
        userName: form.userName,
        phoneNumber: form.phoneNumber,
        whatsAppNumber: form.whatsAppNumber || undefined,
      });

      if (!res.success) {
        toastError(t("profile.edit.errorTitle"), { description: res.message });
        return;
      }

      setDetails(res.data);
      setUser({
        userId: res.data.userId,
        name: res.data.name,
        email: res.data.email,
        role: (
          res.data.roles.map((r) => r.toLowerCase()).includes("admin") ? "admin" : "user"
        ) as UserRole,
      });
      setIsEditing(false);
      success(t("profile.edit.successTitle"), {
        description: t("profile.edit.successDescription"),
      });
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? err.message)
        : t("profile.edit.errorTitle");
      toastError(t("profile.edit.errorTitle"), { description: message });
    } finally {
      setIsSaving(false);
    }
  };

  // ── change-password handlers ─────────────────────────
  const handlePwChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPwForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toastError(t("profile.password.mismatchTitle"), {
        description: t("profile.password.mismatchDescription"),
      });
      return;
    }

    setIsChangingPw(true);
    try {
      const res = await changePassword({
        oldPassword: pwForm.oldPassword,
        newPassword: pwForm.newPassword,
        confirmPassword: pwForm.confirmPassword,
      });

      if (!res.success) {
        toastError(t("profile.password.errorTitle"), { description: res.message });
        return;
      }

      setPwForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      success(t("profile.password.successTitle"), {
        description: t("profile.password.successDescription"),
      });
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? err.message)
        : t("profile.password.errorTitle");
      toastError(t("profile.password.errorTitle"), { description: message });
    } finally {
      setIsChangingPw(false);
    }
  };

  const createdAt = details?.createdAt
    ? new Date(details.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  if (!isLoading && loadError) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-28 pb-12 sm:px-6">
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-destructive" />
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="rounded-full bg-destructive/10 p-4">
              <X className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">{t("profile.loadError")}</p>
              <p className="text-sm text-muted-foreground">{t("profile.loadErrorDescription")}</p>
            </div>
            <Button variant="outline" onClick={loadProfile} className="gap-2">
              <Loader2 className="h-4 w-4" />
              {t("profile.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pt-20 pb-12 sm:px-6">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
            {t("profile.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("profile.subtitle")}
          </p>
        </div>
        {!isLoading && !isEditing && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/60"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {t("profile.edit.button")}
          </Button>
        )}
      </div>

      {/* ── Identity card ───────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="h-2 bg-linear-to-r from-primary/60 via-primary to-primary/60" />

        <CardHeader className="pb-4 pt-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="flex flex-wrap gap-2">
                {details?.isActive && (
                  <Badge className="border-green-500/30 bg-green-500/15 text-green-600">
                    {t("profile.active")}
                  </Badge>
                )}
              </div>
            </div>
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
          ) : isEditing ? (
            /* ── Edit form ──────────────────────────────── */
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <EditField id="name" label={t("profile.fields.fullName")} icon={<User className="h-4 w-4" />}>
                  <Input id="name" name="name" value={form.name} onChange={handleChange}
                    disabled={isSaving} placeholder={t("profile.edit.namePlaceholder")}
                    className="bg-background border-border/70 focus:border-primary" />
                </EditField>

                <EditField id="userName" label={t("profile.fields.username")} icon={<User className="h-4 w-4" />}>
                  <Input id="userName" name="userName" value={form.userName} onChange={handleChange}
                    disabled={isSaving} placeholder={t("profile.edit.usernamePlaceholder")}
                    className="bg-background border-border/70 focus:border-primary" />
                </EditField>

                <EditField id="phoneNumber" label={t("profile.fields.phone")} icon={<Phone className="h-4 w-4" />}>
                  <Input id="phoneNumber" name="phoneNumber" type="tel" value={form.phoneNumber}
                    onChange={handleChange} disabled={isSaving} placeholder={t("profile.edit.phonePlaceholder")}
                    className="bg-background border-border/70 focus:border-primary" />
                </EditField>

                <EditField id="whatsAppNumber" label={t("profile.fields.whatsapp")} icon={<MessageCircle className="h-4 w-4" />}>
                  <Input id="whatsAppNumber" name="whatsAppNumber" type="tel" value={form.whatsAppNumber}
                    onChange={handleChange} disabled={isSaving} placeholder={t("profile.edit.whatsappPlaceholder")}
                    className="bg-background border-border/70 focus:border-primary" />
                </EditField>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="break-all">{details?.email}</span>
              </div>

              <div className="flex gap-3 pt-1">
                <Button onClick={handleSave} disabled={isSaving}
                  className="gap-2 bg-primary text-primary-foreground hover:glow-primary">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {isSaving ? t("profile.edit.saving") : t("profile.edit.save")}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={isSaving} className="gap-2">
                  <X className="h-4 w-4" />
                  {t("profile.edit.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            /* ── View mode ──────────────────────────────── */
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileField icon={<User className="h-4 w-4" />} label={t("profile.fields.fullName")} value={details?.name} />
              <ProfileField icon={<User className="h-4 w-4" />} label={t("profile.fields.username")} value={details?.userName} />
              <ProfileField icon={<Mail className="h-4 w-4" />} label={t("profile.fields.email")} value={details?.email} />
              <ProfileField icon={<Phone className="h-4 w-4" />} label={t("profile.fields.phone")} value={details?.phoneNumber} />
              <ProfileField icon={<MessageCircle className="h-4 w-4" />} label={t("profile.fields.whatsapp")} value={details?.whatsAppNumber} />
              <ProfileField icon={<Calendar className="h-4 w-4" />} label={t("profile.fields.memberSince")} value={createdAt} />
            </dl>
          )}
        </CardContent>
      </Card>

      {/* ── Change password card ─────────────────────────── */}
      {!isEditing && (
        <Card className="overflow-hidden">
          <div className="h-2 bg-linear-to-r from-destructive/40 via-destructive/70 to-destructive/40" />

          <CardHeader className="pb-3 pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <KeyRound className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{t("profile.password.title")}</p>
                <p className="text-xs text-muted-foreground">{t("profile.password.subtitle")}</p>
              </div>
            </div>
          </CardHeader>

          <Separator />

          <CardContent className="pt-5">
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <EditField id="oldPassword" label={t("profile.password.oldPassword")} icon={<Lock className="h-4 w-4" />}>
                  <Input id="oldPassword" name="oldPassword" type="password"
                    value={pwForm.oldPassword} onChange={handlePwChange}
                    disabled={isChangingPw} placeholder={t("profile.password.oldPlaceholder")}
                    className="bg-background border-border/70 focus:border-primary" />
                </EditField>

                <EditField id="newPassword" label={t("profile.password.newPassword")} icon={<Lock className="h-4 w-4" />}>
                  <Input id="newPassword" name="newPassword" type="password"
                    value={pwForm.newPassword} onChange={handlePwChange}
                    disabled={isChangingPw} placeholder={t("profile.password.newPlaceholder")}
                    className="bg-background border-border/70 focus:border-primary" />
                </EditField>

                <EditField id="confirmPassword" label={t("profile.password.confirmPassword")} icon={<Lock className="h-4 w-4" />}>
                  <Input id="confirmPassword" name="confirmPassword" type="password"
                    value={pwForm.confirmPassword} onChange={handlePwChange}
                    disabled={isChangingPw} placeholder={t("profile.password.confirmPlaceholder")}
                    className="bg-background border-border/70 focus:border-primary" />
                </EditField>
              </div>

              <Button type="submit" disabled={isChangingPw}
                className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isChangingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {isChangingPw ? t("profile.password.saving") : t("profile.password.save")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Quick-nav actions ────────────────────────────── */}
      {!isEditing && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/feed")}>
            <Rss className="h-4 w-4" />
            {t("profile.actions.goToFeed")}
          </Button>

          {user?.role === "user" && (
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/seller")}>
              <LayoutDashboard className="h-4 w-4" />
              {t("profile.actions.sellerDashboard")}
            </Button>
          )}

          {user?.role === "admin" && (
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/admin")}>
              <ShieldCheck className="h-4 w-4" />
              {t("profile.actions.adminDashboard")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────── */

type ProfileFieldProps = {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
};

function ProfileField({ icon, label, value }: ProfileFieldProps) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted/40 px-4 py-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="wrap-break-word text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

type EditFieldProps = {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
};

function EditField({ id, label, icon, children }: EditFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}
