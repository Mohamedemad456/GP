import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Button, Label } from "@gp/design-system";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Separator,
  Textarea,
} from "@/lib";
import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";

const Contact = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith("ar") ?? false;

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 900));

    toast.success(t("contact.form.success.title"), {
      description: t("contact.form.success.description"),
    });

    setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
    setIsSubmitting(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const contactInfo = [
    {
      icon: Mail,
      title: t("contact.info.email.title"),
      content: t("contact.info.email.content"),
      link: "mailto:info@sayarti.com",
    },
    {
      icon: Phone,
      title: t("contact.info.phone.title"),
      content: t("contact.info.phone.content"),
      link: "tel:+1234567890",
    },
    {
      icon: MapPin,
      title: t("contact.info.address.title"),
      content: t("contact.info.address.content"),
      link: "#",
    },
    {
      icon: Clock,
      title: t("contact.info.hours.title"),
      content: t("contact.info.hours.content"),
      link: "#",
    },
  ];

  return (
    <div className="min-h-screen pt-16">
      {/* Hero */}
      <section className="relative overflow-hidden hero-gradient">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-18 sm:py-22">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 py-2 backdrop-blur-sm shadow-sm">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">
                {t("contact.hero.badge", {
                  defaultValue: "Fast response • Real support",
                })}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-heading tracking-tight">
              {t("contact.hero.title")}
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-muted-foreground">
              {t("contact.hero.subtitle")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl font-heading">
                    {t("contact.form.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("contact.form.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">
                          {t("contact.form.name.label")}
                        </Label>
                        <Input
                          id="name"
                          name="name"
                          type="text"
                          required
                          value={formData.name}
                          onChange={handleChange}
                          placeholder={t("contact.form.name.placeholder")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">
                          {t("contact.form.email.label")}
                        </Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          placeholder={t("contact.form.email.placeholder")}
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">
                          {t("contact.form.phone.label")}
                        </Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder={t("contact.form.phone.placeholder")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subject">
                          {t("contact.form.subject.label")}
                        </Label>
                        <Input
                          id="subject"
                          name="subject"
                          type="text"
                          required
                          value={formData.subject}
                          onChange={handleChange}
                          placeholder={t("contact.form.subject.placeholder")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">
                        {t("contact.form.message.label")}
                      </Label>
                      <Textarea
                        id="message"
                        name="message"
                        required
                        rows={6}
                        value={formData.message}
                        onChange={handleChange}
                        placeholder={t("contact.form.message.placeholder")}
                      />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full bg-primary text-primary-foreground hover:glow-primary"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        t("contact.form.submitting")
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          {t("contact.form.submit")}
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight">
                  {t("contact.info.title")}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {t("contact.info.description")}
                </p>
              </div>

              <div className="space-y-3">
                {contactInfo.map((info) => {
                  const Icon = info.icon;
                  return (
                    <Card
                      key={info.title}
                      className="border-border/60 shadow-sm"
                    >
                      <CardContent className="p-5">
                        <div className="flex gap-4">
                          <div className="h-fit rounded-2xl bg-primary/10 p-3">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold">{info.title}</div>
                            {info.link !== "#" ? (
                              <a
                                href={info.link}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {info.content}
                              </a>
                            ) : (
                              <div className="text-muted-foreground">
                                {info.content}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Separator />

              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-6">
                  <div className="font-semibold font-heading">
                    {t("contact.faq.title")}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("contact.faq.description")}
                  </p>
                  <div className="mt-4">
                    <Button variant="outline" size="sm">
                      {t("contact.faq.button")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
