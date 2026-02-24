import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Input } from "@gp/design-system";
import { useToast } from "@/hooks/use-toast";
import { Car, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components";
import { setAuthSession } from "@/lib/auth";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    setAuthSession({
      email: formData.email,
      role: "user",
      createdAt: new Date().toISOString(),
    });

    const redirectPath =
      (location.state as { from?: { pathname?: string } } | null)?.from
        ?.pathname ?? "/feed";

    toast(t("auth.toastTitle"), {
      description: t("auth.toastDescription"),
    });
    navigate(redirectPath, { replace: true });
    setFormData({
      email: "",
      password: "",
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

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
          {/* Logo */}
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
                className="w-full bg-background border-border/70 focus:border-primary transition-smooth"
                placeholder={t("auth.passwordPlaceholder")}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full bg-primary text-primary-foreground hover:glow-primary transition-smooth"
            >
              {t("auth.signIn")}
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
