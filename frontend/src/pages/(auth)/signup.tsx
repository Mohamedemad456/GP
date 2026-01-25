import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input } from "@gp/design-system";
import { useToast } from "@/hooks/use-toast";
import { Car, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const Signup = () => {
  const navigate = useNavigate();
  const { error, success } = useToast();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      error(t("auth.passwordMismatchTitle"), {
        description: t("auth.passwordMismatchDescription"),
      });
    } else {    
      success(t("auth.signupToastTitle"), {
        description: t("auth.signupToastDescription"),
      });
      setTimeout(() => navigate("/"), 1000);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 hero-gradient py-12 flex-col">
      <div className="flex items-center justify-between w-full mb-8">
      <div className="fixed top-6 right-6">
        <LanguageSwitcher />
      </div>
      <Link
        to="/"
        className="fixed top-6 left-6 flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-fast group"
      >
        <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-smooth" />
        <span>{t("auth.backToHome")}</span>
      </Link>
      </div>
      <div className="w-full max-w-md">
        <div className="bg-card p-8 rounded-2xl border border-border shadow-2xl animate-scale-in">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="bg-primary p-3 rounded-xl">
              <Car className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">{t("auth.signupHeading")}</h1>
            <p className="text-muted-foreground">{t("auth.signupSubheading")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                className="w-full bg-secondary border-border focus:border-primary transition-smooth"
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
                className="w-full bg-secondary border-border focus:border-primary transition-smooth"
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
                className="w-full bg-secondary border-border focus:border-primary transition-smooth"
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
                className="w-full bg-secondary border-border focus:border-primary transition-smooth"
                placeholder={t("auth.passwordPlaceholder")}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full bg-primary text-primary-foreground hover:glow-primary transition-smooth"
            >
              {t("auth.signUp")}
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
