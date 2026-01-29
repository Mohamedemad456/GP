import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const LanguageSwitcher = memo(function LanguageSwitcher({
  className,
}: {
  className?: string;
}) {
  const { i18n } = useTranslation();

  const normalizedLanguage = useMemo(
    () => (i18n.language?.startsWith("ar") ? "ar" : "en"),
    [i18n.language],
  );
  const nextLanguage = useMemo(
    () => (normalizedLanguage === "ar" ? "en" : "ar"),
    [normalizedLanguage],
  );
  const isArabic = normalizedLanguage === "ar";

  const toggleLanguage = () => {
    i18n.changeLanguage(nextLanguage);
    try {
      localStorage.setItem("i18nextLng", nextLanguage);
    } catch (err) {
      console.warn("Unable to persist language preference", err);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label="Toggle language"
      className={cn(
        "group relative flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300",
        className,
      )}
    >
      {/* Globe icon background */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          className="h-10 w-10 text-white/20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </div>

      <div className="relative h-8 w-12 overflow-hidden">
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            !isArabic ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0"
          }`}
          style={{ transformStyle: "preserve-3d" }}
        >
          <span className="text-xl font-bold text-white drop-shadow-md">
            EN
          </span>
        </div>
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            isArabic ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
          style={{ transformStyle: "preserve-3d" }}
        >
          <span className="text-xl font-bold text-white drop-shadow-md">
            AR
          </span>
        </div>
      </div>
      <div className="absolute inset-0 rounded-2xl bg-linear-to-tr from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </button>
  );
});

export default LanguageSwitcher;
