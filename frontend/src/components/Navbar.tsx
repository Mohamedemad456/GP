import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Car } from "lucide-react";
import { Button } from "@/lib";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { t, i18n } = useTranslation();

  // Detect RTL language
  const isRTL = i18n.language?.startsWith("ar") ?? false;

  const navLinks = [
    { name: t("navigation.home"), path: "/" },
    { name: t("navigation.about"), path: "/about" },
    { name: t("navigation.contact"), path: "/contact" },
  ];

  
  const isActive = (path: string) => location.pathname === path;

  return (
    <motion.nav
      className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-lg border-b border-border transition-smooth"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 relative justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            {!isRTL ? (
              <>
                <motion.div
                  className="bg-primary p-2 rounded-lg transition-smooth group-hover:glow-primary"
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.6 }}
                >
                  <Car className="h-6 w-6 text-primary-foreground" />
                </motion.div>
                <motion.span
                  className="text-2xl font-bold tracking-tight font-heading"
                  whileHover={{ scale: 1.05 }}
                >
                  {t("navigation.logo")}
                </motion.span>
              </>
            ) : (
              <>
                <motion.div
                  className="bg-primary p-2 rounded-lg transition-smooth group-hover:glow-primary"
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.6 }}
                >
                  <Car className="h-6 w-6 text-primary-foreground" />
                </motion.div>
                <motion.span
                  className="text-2xl font-bold tracking-tight font-heading"
                  whileHover={{ scale: 1.05 }}
                >
                  {t("navigation.logo")}
                </motion.span>
              </>
            )}
          </Link>

          {/* Desktop Navigation - Centered */}
          <motion.div
            className={`hidden md:flex items-center gap-8 absolute ${
              isRTL ? "right-1/2 translate-x-1/2" : "left-1/2 -translate-x-1/2"
            }`}
            style={{ direction: isRTL ? "rtl" : "ltr" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {navLinks.map((link, index) => (
              <motion.div
                key={link.path}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Link
                  to={link.path}
                  className={`text-sm font-medium transition-smooth relative group font-heading ${
                    isActive(link.path)
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.name}
                  {isActive(link.path) ? (
                    <motion.span
                      className={`absolute -bottom-1 w-full h-0.5 bg-primary ${
                        isRTL ? "right-0" : "left-0"
                      }`}
                      layoutId="navbar-active-underline"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      style={{ originX: isRTL ? 1 : 0 }}
                    />
                  ) : (
                    <motion.span
                      className={`absolute -bottom-1 w-full h-0.5 bg-primary/0 ${
                        isRTL ? "right-0" : "left-0"
                      }`}
                      whileHover={{ backgroundColor: "hsl(var(--primary))" }}
                      transition={{ duration: 0.2 }}
                      style={{ originX: isRTL ? 1 : 0 }}
                    />
                  )}
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* Auth Buttons */}
          <div
            className={`hidden md:flex items-center gap-3 ${
              isRTL ? "flex-row-reverse mr-auto" : "ml-auto"
            }`}
          >
            {!isRTL ? (
              <>
                <LanguageSwitcher />
                <Link to="/login">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="transition-smooth hover:bg-primary hover:text-primary-foreground hover:border-primary font-sans"
                    >
                      {t("navigation.login")}
                    </Button>
                  </motion.div>
                </Link>
                <Link to="/signup">
                  <motion.div
                    whileHover={{
                      scale: 1.05,
                      boxShadow: "0 0 20px hsl(var(--primary) / 0.4)",
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground hover:glow-primary transition-smooth font-sans"
                    >
                      {t("auth.signUp")}
                    </Button>
                  </motion.div>
                </Link>
              </>
            ) : (
              <>
                <Link to="/signup">
                  <motion.div
                    whileHover={{
                      scale: 1.05,
                      boxShadow: "0 0 20px hsl(var(--primary) / 0.4)",
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground hover:glow-primary transition-smooth font-sans"
                    >
                      {t("auth.signUp")}
                    </Button>
                  </motion.div>
                </Link>
                <Link to="/login">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="transition-smooth hover:bg-primary hover:text-primary-foreground hover:border-primary font-sans"
                    >
                      {t("navigation.login")}
                    </Button>
                  </motion.div>
                </Link>
                <LanguageSwitcher />
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="md:hidden flex items-center gap-2" />
            <motion.button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-secondary transition-fast flex justify-between"
              whileTap={{ scale: 0.9 }}
            >
              <AnimatePresence mode="wait">
                {isOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="h-6 w-6" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2"
                  >
                    <Menu className="h-6 w-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="md:hidden bg-card border-t border-border"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="px-4 py-4 flex flex-col gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.path}
                  initial={{ x: isRTL ? 50 : -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className={`block px-4 py-2 rounded-lg transition-fast ${
                      isActive(link.path)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                className="pt-3 flex flex-col gap-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="block"
                >
                  <Button variant="outline" className="w-full">
                    {t("navigation.login")}
                  </Button>
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setIsOpen(false)}
                  className="block"
                >
                  <Button className="w-full bg-primary text-primary-foreground">
                    {t("auth.signUp")}
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
