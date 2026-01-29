import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { Instagram, Twitter, Facebook } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Separator } from "@/lib";

const Footer = memo(() => {
  const { t, i18n } = useTranslation();
  const isRTL = useMemo(
    () => i18n.language?.startsWith("ar") ?? false,
    [i18n.language],
  );
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <footer
      className="mt-10 border-t border-border bg-background/90 backdrop-blur-lg"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div
          className={`grid gap-8 md:grid-cols-3 items-start ${
            isRTL ? "text-right" : "text-left"
          }`}
        >
          {/* Brand + tagline */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-xs font-medium uppercase tracking-wide text-primary">
                {t("navigation.logo")}
              </span>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {t("footer.quickLinks")}
            </h3>
            <nav
              className={`flex flex-col gap-2 text-sm items-start`}
            >
              <Link
                to="/"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("navigation.home")}
              </Link>
              <Link
                to="/about"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("navigation.about")}
              </Link>
              <Link
                to="/contact"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("navigation.contact")}
              </Link>
            </nav>
          </div>

          {/* Contact + socials */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("footer.contact")}
            </h3>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">{t("footer.emailLabel")}:</span>{" "}
                <a
                  href={`mailto:${t("contact.info.email.content")}`}
                  className="hover:text-foreground transition-colors"
                >
                  {t("contact.info.email.content")}
                </a>
              </div>
              <div>
                <span className="font-medium">{t("footer.phoneLabel")}:</span>{" "}
                <a
                  href={`tel:${t("contact.info.phone.content")}`}
                  className="hover:text-foreground transition-colors"
                >
                  {t("contact.info.phone.content")}
                </a>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("footer.socialLabel")}
              </p>
              <div
                className={`flex gap-2 ${
                  isRTL ? "justify-end" : "justify-start"
                }`}
              >
                {[Instagram, Twitter, Facebook].map((Icon, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors"
                    aria-label="Social link"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-6 opacity-60" />

        <div
          className={`flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between ${
            isRTL ? "text-right" : "text-left"
          }`}
        >
          <span>{t("footer.copyright", { year })}</span>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
