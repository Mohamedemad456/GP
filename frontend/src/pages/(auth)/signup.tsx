import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Input } from "@gp/design-system";
import { useToast } from "@/hooks/use-toast";
import {
  Car,
  ArrowLeft,
  Loader2,
  User,
  Mail,
  Phone,
  MessageCircle,
  Lock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { registerUser } from "@/lib/authApi";
import axios from "axios";

const Signup = () => {
  const { error, success } = useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    whatsAppNumber: "",
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
        whatsAppNumber: formData.whatsAppNumber || undefined,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      if (!tokenRes.success) {
        error(t("auth.signupFailedTitle"), { description: tokenRes.message });
        return;
      }

      success(t("auth.signupToastTitle"), {
        description: t("auth.signupToastDescription"),
      });
      // Use a direct URL transition to avoid GuestRoute timing races
      // right after cookies are set by registration.
      window.location.replace("/onboarding");
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

      <div className="w-full max-w-xl">
        <div className="bg-card/95 rounded-2xl border border-border/60 shadow-xl animate-scale-in overflow-hidden">

          {/* Branded header band */}
          <div className="bg-primary/10 border-b border-primary/15 px-8 py-6 flex items-center gap-4">
            <div className="bg-primary p-2.5 rounded-xl shadow-sm shrink-0">
              <Car className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-heading text-foreground leading-tight">
                {t("auth.signupHeading")}
              </h1>
              <p className="text-sm text-muted-foreground">{t("auth.signupSubheading")}</p>
            </div>
          </div>

          <div className="px-8 py-7">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Full name — full width */}
              <FormField
                id="name"
                label={t("auth.nameLabel")}
                icon={<User className="h-4 w-4" />}
              >
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
              </FormField>

              {/* Email — full width */}
              <FormField
                id="email"
                label={t("auth.emailLabel")}
                icon={<Mail className="h-4 w-4" />}
              >
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
              </FormField>

              {/* Phone + WhatsApp — two columns */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField
                  id="phoneNumber"
                  label={t("auth.phoneLabel")}
                  icon={<Phone className="h-4 w-4" />}
                >
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
                </FormField>

                <FormField
                  id="whatsAppNumber"
                  label={t("auth.whatsAppLabel")}
                  icon={<MessageCircle className="h-4 w-4" />}
                >
                  <Input
                    id="whatsAppNumber"
                    name="whatsAppNumber"
                    type="tel"
                    value={formData.whatsAppNumber}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="w-full bg-background border-border/70 focus:border-primary transition-smooth"
                    placeholder={t("auth.whatsAppPlaceholder")}
                  />
                </FormField>
              </div>

              {/* Password divider */}
              <div className="flex items-center gap-3 pt-1">
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  {t("auth.passwordLabel")}
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>

              {/* Password + Confirm — two columns */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField
                  id="password"
                  label={t("auth.passwordLabel")}
                  icon={<Lock className="h-4 w-4" />}
                >
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
                </FormField>

                <FormField
                  id="confirmPassword"
                  label={t("auth.confirmPasswordLabel")}
                  icon={<Lock className="h-4 w-4" />}
                >
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
                </FormField>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground hover:glow-primary transition-smooth mt-1"
              >
                {isLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : t("auth.signUp")}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
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

type FormFieldProps = {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
};

function FormField({ id, label, icon, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-sm font-medium text-foreground"
      >
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

export default Signup;
