import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Input } from "@gp/design-system";
import { useToast } from "@/hooks/use-toast";
import { Car, ArrowLeft, Loader2 } from "lucide-react";
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

      // Fetch profile — backend cookie is now set, so this works immediately
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
        <div className="bg-card/95 p-8 rounded-2xl border border-border/60 shadow-xl animate-scale-in">
          <div className="flex justify-center mb-8">
            <div className="bg-primary p-3 rounded-2xl shadow-sm">
              <Car className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 font-heading">{t("auth.heading")}</h1>
            <p className="text-muted-foreground">{t("auth.subheading")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
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

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
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
              className="w-full bg-primary text-primary-foreground hover:glow-primary transition-smooth"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.signIn")}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
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
