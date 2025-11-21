import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Button } from "@/lib";
import { ArrowRight } from "lucide-react";
import heroCarImage from "@/assets/hero-car.jpg";

const Home = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith("ar") ?? false;

  return (
    <div className="relative min-h-screen">
      {/* Hero Section with Parallax Background */}
      <section className="relative h-screen overflow-hidden">
        {/* Fixed Background Image with Parallax Effect */}
        <div
          className="fixed inset-0 w-full h-[120%] -z-10"
          style={{
            backgroundImage: `url(${heroCarImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
            willChange: "transform",
          }}
        >
          {/* Gradient Overlay for Fade Effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background/95" />
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 h-full flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 text-foreground drop-shadow-lg">
                {t("hero.title")}
              </h1>
              <p className="text-xl sm:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto drop-shadow-md">
                {t("hero.subtitle")}
              </p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              >
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:glow-primary transition-smooth font-mono text-lg px-8 py-6"
                >
                  {t("hero.cta")}
                  <ArrowRight
                    className={`ml-2 h-5 w-5 inline-block ${isRTL ? "rotate-180" : ""}`}
                  />
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-6 h-10 border-2 border-foreground/30 rounded-full flex justify-center"
          >
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-1 h-3 bg-foreground/50 rounded-full mt-2"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* Content Section that scrolls over the image */}
      <section className="relative z-20 bg-background min-h-screen pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4">Welcome</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              This content scrolls over the hero image, creating a parallax effect.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;

