import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@gp/design-system";
import { Award, Car, Heart, Shield, TrendingUp, Users } from "lucide-react";

type ValueItem = {
  icon: typeof Shield;
  title: string;
  description: string;
};

const About = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith("ar") ?? false;

  const stats = [
    { label: t("about.stats.customers"), value: "50K+" },
    { label: t("about.stats.vehicles"), value: "10K+" },
    { label: t("about.stats.years"), value: "10+" },
    { label: t("about.stats.satisfaction"), value: "98%" },
  ];

  const values: ValueItem[] = [
    {
      icon: Shield,
      title: t("about.values.trust.title"),
      description: t("about.values.trust.description"),
    },
    {
      icon: Award,
      title: t("about.values.quality.title"),
      description: t("about.values.quality.description"),
    },
    {
      icon: TrendingUp,
      title: t("about.values.innovation.title"),
      description: t("about.values.innovation.description"),
    },
    {
      icon: Heart,
      title: t("about.values.customer.title"),
      description: t("about.values.customer.description"),
    },
  ];

  return (
    <div className="min-h-screen pt-16">
      {/* Hero */}
      <section className="hero-gradient">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-primary p-3 shadow-sm">
                <Car className="h-7 w-7 text-primary-foreground" />
              </div>
              <Badge
                variant="secondary"
                className="mb-6 px-5 py-2.5 rounded-full border border-border/60 bg-background/80"
              >
                {t("about.hero.badge", {
                  defaultValue: "Trust • Quality • Innovation",
                })}
              </Badge>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-heading tracking-tight">
              {t("about.hero.title")}
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-muted-foreground">
              {t("about.hero.subtitle")}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/contact">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:glow-primary"
                >
                  {t("about.cta.contact")}
                </Button>
              </Link>
              <Link to="/">
                <Button size="lg" variant="outline">
                  {t("about.cta.explore")}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05, duration: 0.45 }}
                className="rounded-2xl border border-border/60 bg-card px-4 py-6 text-center shadow-sm"
              >
                <div className="text-3xl sm:text-4xl font-bold text-primary font-heading">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold font-heading tracking-tight">
                {t("about.mission.title")}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {t("about.mission.description")}
              </p>
              <p className="mt-3 text-lg text-muted-foreground">
                {t("about.mission.description2")}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.05 }}
            >
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <div className="inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 mb-3">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl font-heading">
                    {t("about.mission.cardTitle")}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {t("about.mission.cardDescription")}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 sm:py-20 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold font-heading tracking-tight">
              {t("about.values.title")}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("about.values.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05, duration: 0.45 }}
                >
                  <Card className="h-full border-border/60 shadow-sm hover:shadow-md transition-smooth">
                    <CardHeader>
                      <div className="inline-flex items-center justify-center rounded-2xl bg-primary/10 p-3 mb-3">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-xl font-heading">
                        {value.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{value.description}</CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
