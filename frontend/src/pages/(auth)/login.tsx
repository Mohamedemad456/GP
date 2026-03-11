import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Input } from "@gp/design-system";
import { useToast } from "@/hooks/use-toast";
import { Car, ArrowLeft, Loader2, Mail, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components";
import { useAuth } from "@/context/AuthContext";
import { loginUser, getProfile } from "@/lib/authApi";
import type { UserRole } from "@/lib/auth";
import axios from "axios";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, error: toastError } = useToast();
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const tokenRes = await loginUser(formData);

      if (!tokenRes.success) {
        toastError(t("auth.loginFailedTitle"), { description: tokenRes.message });
        return;
      }

      const profileRes = await getProfile();
      if (profileRes.success) {
        const u = profileRes.data;
        const role = (
          u.roles.map((r) => r.toLowerCase()).includes("admin") ? "admin" : "user"
        ) as UserRole;
        setUser({ userId: u.userId, name: u.name, email: u.email, role });
      }

      const redirectPath =
        (location.state as { from?: { pathname?: string } } | null)?.from
          ?.pathname ?? "/feed";

      toast(t("auth.toastTitle"), { description: t("auth.toastDescription") });
      setFormData({ email: "", password: "" });
      navigate(redirectPath, { replace: true });
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? err.message)
        : t("auth.loginFailedDescription");
      toastError(t("auth.loginFailedTitle"), { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <div className="min-h-screen flex items-center justify-center px-4 hero-gradient py-12">
      <div className="fixed top-6 right-6 z-20">
        <LanguageSwitcher />
      </div>
      <Link
        to="/"
        className="fixed top-6 left-6 z-20 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-fast group"
      >
        <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-smooth" />
        <span>{t("auth.backToHome")}</span>
      </Link>

      <div className="w-full max-w-md">
        <div className="bg-card/95 rounded-2xl border border-border/60 shadow-xl animate-scale-in overflow-hidden">

          {/* Branded header band */}
          <div className="bg-primary/10 border-b border-primary/15 px-8 py-6 flex items-center gap-4">
            <div className="bg-primary p-2.5 rounded-xl shadow-sm shrink-0">
              <Car className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-heading text-foreground leading-tight">
                {t("auth.heading")}
              </h1>
              <p className="text-sm text-muted-foreground">{t("auth.subheading")}</p>
            </div>
          </div>

          <div className="px-8 py-7">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="flex items-center gap-1.5 text-sm font-medium text-foreground"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {t("auth.emailLabel")}
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="w-full bg-background border-border/70 focus:border-primary transition-smooth"
                  placeholder={t("auth.emailPlaceholder")}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="flex items-center gap-1.5 text-sm font-medium text-foreground"
                >
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  {t("auth.passwordLabel")}
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="w-full bg-background border-border/70 focus:border-primary transition-smooth"
                  placeholder={t("auth.passwordPlaceholder")}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground hover:glow-primary transition-smooth mt-1"
              >
                {isLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : t("auth.signIn")}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              {t("auth.noAccount")}{" "}
              <Link to="/signup" className="text-primary hover:underline font-medium">
                {t("auth.signUp")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
