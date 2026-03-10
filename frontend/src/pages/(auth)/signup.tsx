import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input } from "@gp/design-system";
import { useToast } from "@/hooks/use-toast";
import { Car, ArrowLeft, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/context/AuthContext";
import { registerUser, getProfile } from "@/lib/authApi";
import type { UserRole } from "@/lib/auth";
import axios from "axios";

const Signup = () => {
  const navigate = useNavigate();
  const { error, success } = useToast();
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      error(t("auth.passwordMismatchTitle"), {
        description: t("auth.passwordMismatchDescription"),
      });
      return;
    }

    setIsLoading(true);

    try {
      const tokenRes = await registerUser({
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      if (!tokenRes.success) {
        error(t("auth.signupFailedTitle"), { description: tokenRes.message });
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

      success(t("auth.signupToastTitle"), {
        description: t("auth.signupToastDescription"),
      });
      setTimeout(() => navigate("/onboarding"), 1000);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? err.message)
        : t("auth.signupFailedDescription");
      error(t("auth.signupFailedTitle"), { description: message });
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
            <h1 className="text-3xl font-bold mb-2 font-heading">
              {t("auth.signupHeading")}
            </h1>
            <p className="text-muted-foreground">{t("auth.signupSubheading")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                {t("auth.nameLabel")}
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full bg-background border-border/70 focus:border-primary transition-smooth"
                placeholder={t("auth.namePlaceholder")}
              />
            </div>

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
              <label htmlFor="phoneNumber" className="block text-sm font-medium mb-2">
                {t("auth.phoneLabel")}
              </label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                required
                value={formData.phoneNumber}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full bg-background border-border/70 focus:border-primary transition-smooth"
                placeholder={t("auth.phonePlaceholder")}
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                {t("auth.confirmPasswordLabel")}
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
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
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.signUp")}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("auth.hasAccount")}{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">
                {t("auth.signIn")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
