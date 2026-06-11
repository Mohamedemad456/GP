import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Car, FileText, Loader2, Phone, Save, Sparkles, Tag, TrendingUp, X
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import {
  getMyListingDetails,
  updateListing,
  generateListingPrice,
  setListingPrice,
  FuelType,
  TransmissionType,
  type GeneratePriceResponseDto,
} from "@/lib/listingsApi";
import { getActiveMakes, type MakeDto } from "@/lib/makesApi";
import { getActiveModels, type ModelDto } from "@/lib/modelsApi";
import { getAllLookups, type LookupGroupDto } from "@/lib/lookupsApi";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Combobox,
  PageLoader,
} from "@gp/design-system";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 40 }, (_, i) => currentYear + 1 - i);

const COLORS = [
  "Black", "White", "Silver", "Gray", "Red", "Blue",
  "Brown", "Green", "Beige", "Gold", "Yellow", "Other",
];

// Mirrors backend PreferredContactMethod enum
const PreferredContactMethod = {
  Phone: 1,
  WhatsApp: 2,
  Both: 3,
} as const;

const PREFERRED_CONTACT_OPTIONS = [
  { value: PreferredContactMethod.Phone,    label: "Phone" },
  { value: PreferredContactMethod.WhatsApp, label: "WhatsApp" },
  { value: PreferredContactMethod.Both,     label: "Both" },
];

const SECTION_CARD_CLASS =
  "overflow-hidden rounded-3xl border-border/60 bg-card/80 shadow-sm backdrop-blur-xl transition-colors hover:border-primary/20";
const SECTION_HEADER_CLASS = "border-b border-border/40 bg-muted/20 px-6 py-5";

function FormField({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Small stat tile used inside the pricing section */
function PriceTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-2xl border p-4 ${
        highlight
          ? "border-primary/30 bg-primary/5"
          : "border-border/50 bg-muted/30"
      }`}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className={`text-xl font-bold tracking-tight ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

type FormState = {
  makeId: string;
  modelId: string;
  year: string;
  mileage: string;
  fuelType: string;
  transmission: string;
  location: string;
  engineSize: string;
  color: string;
  description: string;
  contactPhoneNumber: string;
  whatsAppNumber: string;
  preferredContactMethod: string;
};

// Formats a number as EGP currency
function formatEGP(value: number) {
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function EditListing() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { success, error } = useToast();
  const isRtl = i18n.language?.startsWith("ar");

  const pricingSectionRef = useRef<HTMLDivElement>(null);

  // ── Page load state ──────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);

  // ── Save / generate / set-price async states ─────────────────────────────
  const [isSaving, setIsSaving]         = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSettingPrice, setIsSettingPrice] = useState(false);

  // ── Reference data ────────────────────────────────────────────────────────
  const [makes, setMakes]           = useState<MakeDto[]>([]);
  const [allModels, setAllModels]   = useState<ModelDto[]>([]);
  const [lookupGroups, setLookupGroups] = useState<LookupGroupDto[]>([]);

  const [isLoadingMakes, setIsLoadingMakes]     = useState(false);
  const [isLoadingModels, setIsLoadingModels]   = useState(false);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);

  // ── Form ──────────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>({
    makeId: "",
    modelId: "",
    year: "",
    mileage: "",
    fuelType: "",
    transmission: "",
    location: "",
    engineSize: "",
    color: "",
    description: "",
    contactPhoneNumber: "",
    whatsAppNumber: "",
    preferredContactMethod: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // ── ML pricing result ─────────────────────────────────────────────────────
  const [mlPricing, setMlPricing]   = useState<GeneratePriceResponseDto | null>(null);
  // null  → section hidden
  // ""    → accept fair price mode (no custom input needed; we'll handle via toggle)
  const [customPrice, setCustomPrice]           = useState<string>("");
  const [acceptFairPrice, setAcceptFairPrice]   = useState(false);
  const [priceError, setPriceError]             = useState<string>("");

  // ─────────────────────────────────────────────────────────────────────────
  // Data fetching
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setIsLoadingMakes(true);
    getActiveMakes()
      .then((res) => { if (res.success) setMakes(res.data?.data ?? []); })
      .catch((err) => console.error("Failed to fetch makes:", err))
      .finally(() => setIsLoadingMakes(false));

    setIsLoadingModels(true);
    getActiveModels()
      .then((res) => { if (res.success) setAllModels(res.data ?? []); })
      .catch((err) => console.error("Failed to fetch models:", err))
      .finally(() => setIsLoadingModels(false));

    setIsLoadingLookups(true);
    getAllLookups()
      .then((res) => { setLookupGroups(res ?? []); })
      .catch((err) => console.error("Failed to fetch lookups:", err))
      .finally(() => setIsLoadingLookups(false));
  }, []);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    getMyListingDetails(id)
      .then((res) => {
        if (res.success && res.data) {
          const details = res.data;

          const fuelTypeEnum =
            FuelType[details.fuelType as keyof typeof FuelType];
          const transmissionEnum =
            TransmissionType[details.transmission as keyof typeof TransmissionType];
          const preferredContactEnum =
            PreferredContactMethod[
              details.preferredContactMethod as keyof typeof PreferredContactMethod
            ];

          setForm({
            makeId:                 details.makeId,
            modelId:                details.modelId,
            year:                   details.year.toString(),
            mileage:                details.mileage.toString(),
            fuelType:               fuelTypeEnum ? fuelTypeEnum.toString() : "",
            transmission:           transmissionEnum ? transmissionEnum.toString() : "",
            location:               details.locationId ? details.locationId.toString() : "",
            engineSize:             details.engineSize.toString(),
            color:                  details.color,
            description:            details.description,
            contactPhoneNumber:     details.contactPhoneNumber ?? "",
            whatsAppNumber:         details.whatsAppNumber ?? "",
            preferredContactMethod: preferredContactEnum
              ? preferredContactEnum.toString()
              : "",
          });

          // If the listing already has ML pricing, show the section immediately
          if (
            details.fairPrice !== null &&
            details.negotiationRangeLower !== null &&
            details.negotiationRangeUpper !== null
          ) {
            setMlPricing({
              fairPrice:              details.fairPrice,
              negotiationRangeLower:  details.negotiationRangeLower,
              negotiationRangeUpper:  details.negotiationRangeUpper,
              confidenceLevel:        details.confidenceLevel ?? "",
              priceFactors:           [],
              modelVersion:           details.modelVersion ?? "",
              predictedAt:            details.predictedAt ?? "",
            });
          }
        } else {
          error(res.message || "Failed to load listing");
          navigate("/seller/my-listings");
        }
      })
      .catch((err) => {
        console.error("Failed to load listing details:", err);
        error("Failed to load listing");
        navigate("/seller/my-listings");
      })
      .finally(() => setIsLoading(false));
  }, [id, navigate, error]);

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  const updateField = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        if (field === "makeId" && prev.makeId !== value) next.modelId = "";
        return next;
      });
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors]
  );

  const lookupOptionsByNameKey = useMemo(
    () =>
      lookupGroups.reduce<Record<string, LookupGroupDto["options"]>>(
        (acc, group) => { acc[group.nameKey] = group.options; return acc; },
        {}
      ),
    [lookupGroups]
  );

  const locationOptions    = lookupOptionsByNameKey.locations        ?? [];
  const fuelTypeOptions    = lookupOptionsByNameKey.fuelTypes         ?? [];
  const transmissionOptions = lookupOptionsByNameKey.transmissionTypes ?? [];

  const availableModels = useMemo(() => {
    if (!form.makeId) return [];
    return allModels.filter((m) => m.makeId === form.makeId);
  }, [form.makeId, allModels]);

  // ─────────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────────

  const validate = () => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.makeId)        newErrors.makeId       = t("seller.addListing.errors.required");
    if (!form.modelId)       newErrors.modelId      = t("seller.addListing.errors.required");
    if (!form.year)          newErrors.year         = t("seller.addListing.errors.required");
    if (!form.mileage)       newErrors.mileage      = t("seller.addListing.errors.required");
    if (!form.fuelType)      newErrors.fuelType     = t("seller.addListing.errors.required");
    if (!form.transmission)  newErrors.transmission = t("seller.addListing.errors.required");
    if (!form.location)      newErrors.location     = t("seller.addListing.errors.required");
    if (!form.engineSize)    newErrors.engineSize   = t("seller.addListing.errors.required");
    if (!form.color)         newErrors.color        = t("seller.addListing.errors.required");
    if (!form.description || form.description.length < 20) {
      newErrors.description = t("seller.addListing.errors.descriptionTooShort");
    }
    if (!form.contactPhoneNumber) {
      newErrors.contactPhoneNumber = t("seller.addListing.errors.required");
    }
    if (!form.preferredContactMethod) {
      newErrors.preferredContactMethod = t("seller.addListing.errors.required");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Submit handlers
  // ─────────────────────────────────────────────────────────────────────────

  /** Step 1 — save the listing, then auto-generate ML pricing */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      error(t("seller.editListing.errors.fixErrors"));
      return;
    }
    if (!id) return;

    setIsSaving(true);
    try {
      const res = await updateListing(id, {
        makeId:                 form.makeId,
        modelId:                form.modelId,
        year:                   Number(form.year),
        mileage:                Number(form.mileage),
        fuelType:               Number(form.fuelType) as FuelType,
        transmission:           Number(form.transmission) as TransmissionType,
        location:               Number(form.location),
        engineSize:             Number(form.engineSize),
        color:                  form.color,
        description:            form.description,
        contactPhoneNumber:     form.contactPhoneNumber,
        whatsAppNumber:         form.whatsAppNumber,
        preferredContactMethod: Number(form.preferredContactMethod),
      });

      if (!res.success) {
        error(res.message || "Failed to update listing");
        return;
      }

      success(res.message || "Listing updated successfully");
    } catch (err: any) {
      console.error("Update listing error:", err);
      error(err.response?.data?.message || "Failed to update listing");
      return;
    } finally {
      setIsSaving(false);
    }

    // Step 2 — auto-generate ML price after a successful save
    setIsGenerating(true);
    try {
      const priceRes = await generateListingPrice(id);
      if (priceRes.success && priceRes.data) {
        setMlPricing(priceRes.data);
        setCustomPrice("");
        setAcceptFairPrice(false);
        setPriceError("");
        // Scroll to pricing section after it renders
        setTimeout(() => {
          pricingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      } else {
        error(priceRes.message || "Failed to generate price");
      }
    } catch (err: any) {
      console.error("Generate price error:", err);
      error(err.response?.data?.message || "Failed to generate price");
    } finally {
      setIsGenerating(false);
    }
  };

  /** Step 3 — set the final price */
  const handleSetPrice = async () => {
    if (!id || !mlPricing) return;

    if (!acceptFairPrice) {
      const parsed = Number(customPrice);
      if (!customPrice || isNaN(parsed) || parsed <= 0) {
        setPriceError(t("seller.editListing.errors.invalidPrice", "Please enter a valid price."));
        return;
      }
    }
    setPriceError("");

    setIsSettingPrice(true);
    try {
      const res = await setListingPrice(id, {
        price:          acceptFairPrice ? null : Number(customPrice),
        acceptFairPrice,
      });

      if (res.success) {
        success(res.message || "Price set successfully");
        navigate("/seller/my-listings");
      } else {
        error(res.message || "Failed to set price");
      }
    } catch (err: any) {
      console.error("Set price error:", err);
      error(err.response?.data?.message || "Failed to set price");
    } finally {
      setIsSettingPrice(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) return <PageLoader />;

  // While saving+generating we show an overlay state on the button, but keep
  // the form visible so the user can see what's happening.
  const isBusy = isSaving || isGenerating;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("seller.editListing.title", "Edit Listing")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              "seller.editListing.subtitle",
              "Update your vehicle information and description."
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/seller/my-listings")}
          className="gap-2"
        >
          <X className="size-4" />
          {t("common.cancel", "Cancel")}
        </Button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8 pb-10"
        dir={isRtl ? "rtl" : "ltr"}
        noValidate
      >
        {/* ── Vehicle Information ─────────────────────────────────────────── */}
        <Card className={SECTION_CARD_CLASS}>
          <CardHeader className={SECTION_HEADER_CLASS}>
            <CardTitle className="flex items-center gap-3 text-base">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Car className="size-4" />
              </span>
              {t("seller.addListing.vehicleInfo.title")}
            </CardTitle>
            <CardDescription>
              {t("seller.addListing.vehicleInfo.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {/* Make */}
              <FormField label={t("seller.addListing.fields.make")} error={errors.makeId} required>
                <Combobox
                  value={form.makeId}
                  onValueChange={(v) => updateField("makeId", v)}
                  options={makes.map((m) => ({ value: m.id, label: m.name }))}
                  placeholder={
                    isLoadingMakes
                      ? t("seller.addListing.placeholders.loading")
                      : t("seller.addListing.placeholders.make")
                  }
                  searchPlaceholder={t("seller.addListing.placeholders.searchMake")}
                  emptyText={t("seller.addListing.placeholders.noMakeFound")}
                  disabled={isLoadingMakes}
                  aria-invalid={!!errors.makeId}
                />
              </FormField>

              {/* Model */}
              <FormField label={t("seller.addListing.fields.model")} error={errors.modelId} required>
                <Combobox
                  value={form.modelId}
                  onValueChange={(v) => updateField("modelId", v)}
                  options={availableModels.map((m) => ({ value: m.id, label: m.name }))}
                  placeholder={
                    isLoadingModels
                      ? t("seller.addListing.placeholders.loading")
                      : !form.makeId
                        ? t("seller.addListing.placeholders.selectMakeFirst")
                        : t("seller.addListing.placeholders.model")
                  }
                  searchPlaceholder={t("seller.addListing.placeholders.searchModel")}
                  emptyText={t("seller.addListing.placeholders.noModelFound")}
                  disabled={!form.makeId || isLoadingModels}
                  aria-invalid={!!errors.modelId}
                />
              </FormField>

              {/* Year */}
              <FormField label={t("seller.addListing.fields.year")} error={errors.year} required>
                <Select value={form.year} onValueChange={(v) => updateField("year", v)}>
                  <SelectTrigger aria-invalid={!!errors.year} className="h-11 rounded-xl bg-background/80">
                    <SelectValue placeholder={t("seller.addListing.placeholders.year")} />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {/* Mileage */}
              <FormField label={t("seller.addListing.fields.mileage")} error={errors.mileage} required>
                <Input
                  type="number"
                  min={0}
                  placeholder={t("seller.addListing.placeholders.mileage")}
                  value={form.mileage}
                  onChange={(e) => updateField("mileage", e.target.value)}
                  aria-invalid={!!errors.mileage}
                  className="h-11 rounded-xl bg-background/80"
                />
              </FormField>

              {/* Fuel Type */}
              <FormField label={t("seller.addListing.fields.fuelType")} error={errors.fuelType} required>
                <Select value={form.fuelType} onValueChange={(v) => updateField("fuelType", v)}>
                  <SelectTrigger aria-invalid={!!errors.fuelType} className="h-11 rounded-xl bg-background/80">
                    <SelectValue
                      placeholder={
                        isLoadingLookups
                          ? t("seller.addListing.placeholders.loading")
                          : t("seller.addListing.placeholders.fuelType")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {fuelTypeOptions.map((type) => (
                      <SelectItem key={type.value} value={type.value.toString()}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {/* Transmission */}
              <FormField label={t("seller.addListing.fields.transmission")} error={errors.transmission} required>
                <Select value={form.transmission} onValueChange={(v) => updateField("transmission", v)}>
                  <SelectTrigger aria-invalid={!!errors.transmission} className="h-11 rounded-xl bg-background/80">
                    <SelectValue
                      placeholder={
                        isLoadingLookups
                          ? t("seller.addListing.placeholders.loading")
                          : t("seller.addListing.placeholders.transmission")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {transmissionOptions.map((type) => (
                      <SelectItem key={type.value} value={type.value.toString()}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {/* Location */}
              <FormField label={t("seller.addListing.fields.location")} error={errors.location} required>
                <Select value={form.location} onValueChange={(v) => updateField("location", v)} disabled={isLoadingLookups}>
                  <SelectTrigger aria-invalid={!!errors.location} className="h-11 rounded-xl bg-background/80">
                    <SelectValue
                      placeholder={
                        isLoadingLookups
                          ? t("seller.addListing.placeholders.loading")
                          : t("seller.addListing.placeholders.location")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {locationOptions.map((loc) => (
                      <SelectItem key={loc.value} value={loc.value.toString()}>{loc.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {/* Engine Size */}
              <FormField label={t("seller.addListing.fields.engineSize")} error={errors.engineSize} required>
                <Input
                  placeholder={t("seller.addListing.placeholders.engineSize")}
                  value={form.engineSize}
                  onChange={(e) => updateField("engineSize", e.target.value)}
                  aria-invalid={!!errors.engineSize}
                  className="h-11 rounded-xl bg-background/80"
                />
              </FormField>

              {/* Color */}
              <FormField label={t("seller.addListing.fields.color")} error={errors.color} required>
                <Select value={form.color} onValueChange={(v) => updateField("color", v)}>
                  <SelectTrigger aria-invalid={!!errors.color} className="h-11 rounded-xl bg-background/80">
                    <SelectValue placeholder={t("seller.addListing.placeholders.color")} />
                  </SelectTrigger>
                  <SelectContent>
                    {COLORS.map((color) => (
                      <SelectItem key={color} value={color}>{color}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </CardContent>
        </Card>

        {/* ── Contact Information ──────────────────────────────────────────── */}
        <Card className={SECTION_CARD_CLASS}>
          <CardHeader className={SECTION_HEADER_CLASS}>
            <CardTitle className="flex items-center gap-3 text-base">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Phone className="size-4" />
              </span>
              {t("seller.addListing.contactInfo.title")}
            </CardTitle>
            <CardDescription>
              {t("seller.addListing.contactInfo.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {/* Contact Phone */}
              <FormField
                label={t("seller.addListing.fields.contactPhoneNumber")}
                error={errors.contactPhoneNumber}
                required
              >
                <Input
                  type="tel"
                  placeholder={t("seller.addListing.placeholders.contactPhoneNumber")}
                  value={form.contactPhoneNumber}
                  onChange={(e) => updateField("contactPhoneNumber", e.target.value)}
                  aria-invalid={!!errors.contactPhoneNumber}
                  className="h-11 rounded-xl bg-background/80"
                />
              </FormField>

              {/* WhatsApp Number */}
              <FormField label={t("seller.addListing.fields.whatsAppNumber")} error={errors.whatsAppNumber}>
                <Input
                  type="tel"
                  placeholder={t("seller.addListing.placeholders.whatsAppNumber")}
                  value={form.whatsAppNumber}
                  onChange={(e) => updateField("whatsAppNumber", e.target.value)}
                  aria-invalid={!!errors.whatsAppNumber}
                  className="h-11 rounded-xl bg-background/80"
                />
              </FormField>

              {/* Preferred Contact Method */}
              <FormField
                label={t("seller.addListing.fields.preferredContactMethod")}
                error={errors.preferredContactMethod}
                required
              >
                <Select
                  value={form.preferredContactMethod}
                  onValueChange={(v) => updateField("preferredContactMethod", v)}
                >
                  <SelectTrigger aria-invalid={!!errors.preferredContactMethod} className="h-11 rounded-xl bg-background/80">
                    <SelectValue placeholder={t("seller.addListing.placeholders.preferredContactMethod")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PREFERRED_CONTACT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </CardContent>
        </Card>

        {/* ── Description ─────────────────────────────────────────────────── */}
        <Card className={SECTION_CARD_CLASS}>
          <CardHeader className={SECTION_HEADER_CLASS}>
            <CardTitle className="flex items-center gap-3 text-base">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileText className="size-4" />
              </span>
              {t("seller.addListing.descriptionSection.title")}
            </CardTitle>
            <CardDescription>
              {t("seller.addListing.descriptionSection.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <FormField
              label={t("seller.addListing.fields.description")}
              error={errors.description}
              required
            >
              <Textarea
                placeholder={t("seller.addListing.placeholders.description")}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={5}
                aria-invalid={!!errors.description}
                className="min-h-36 rounded-2xl bg-background/80 px-4 py-3 leading-7"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {t("seller.addListing.descriptionSection.helper")}
                </p>
                <p className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {form.description.length} / 20 {t("seller.addListing.minChars")}
                </p>
              </div>
            </FormField>
          </CardContent>
        </Card>

        {/* ── Save Changes button ──────────────────────────────────────────── */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl px-8"
            onClick={() => navigate("/seller/my-listings")}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="submit"
            className="h-12 rounded-xl px-8"
            disabled={isBusy}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 size-5 animate-spin" />
                {t("common.saving", "Saving...")}
              </>
            ) : isGenerating ? (
              <>
                <Loader2 className="mr-2 size-5 animate-spin" />
                {t("seller.editListing.generatingPrice", "Generating price...")}
              </>
            ) : (
              <>
                <Save className="mr-2 size-5" />
                {t("common.save", "Save Changes")}
              </>
            )}
          </Button>
        </div>
      </form>

      {/* ── ML Pricing Section (appears after save+generate) ──────────────── */}
      {(isGenerating || mlPricing) && (
        <div
          ref={pricingSectionRef}
          className="mt-2 pb-10"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <Card className={SECTION_CARD_CLASS}>
            <CardHeader className={SECTION_HEADER_CLASS}>
              <CardTitle className="flex items-center gap-3 text-base">
                <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="size-4" />
                </span>
                {t("seller.editListing.pricingSection.title", "AI Price Recommendation")}
              </CardTitle>
              <CardDescription>
                {t(
                  "seller.editListing.pricingSection.description",
                  "Our model analysed your listing and suggests the following price range. Choose the fair price or enter your own."
                )}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 className="size-10 animate-spin text-primary" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    {t("seller.editListing.generatingPrice", "Generating price...")}
                  </p>
                </div>
              ) : mlPricing ? (
                <>
                  {/* Price tiles */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <PriceTile
                  label={t("seller.editListing.pricingSection.lowerRange", "Lower Range")}
                  value={formatEGP(mlPricing.negotiationRangeLower)}
                />
                <PriceTile
                  label={t("seller.editListing.pricingSection.fairPrice", "Fair Price")}
                  value={formatEGP(mlPricing.fairPrice)}
                  highlight
                />
                <PriceTile
                  label={t("seller.editListing.pricingSection.upperRange", "Upper Range")}
                  value={formatEGP(mlPricing.negotiationRangeUpper)}
                />
              </div>

              {/* Confidence badge */}
              {mlPricing.confidenceLevel && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t("seller.editListing.pricingSection.confidence", "Confidence")}:
                  </span>
                  <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
                    {mlPricing.confidenceLevel}
                  </span>
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-border/40" />

              {/* Accept fair price toggle */}
              <div className="flex items-center gap-3">
                <input
                  id="acceptFairPrice"
                  type="checkbox"
                  checked={acceptFairPrice}
                  onChange={(e) => {
                    setAcceptFairPrice(e.target.checked);
                    if (e.target.checked) {
                      setCustomPrice("");
                      setPriceError("");
                    }
                  }}
                  className="size-4 cursor-pointer accent-primary"
                />
                <Label htmlFor="acceptFairPrice" className="cursor-pointer text-sm">
                  {t(
                    "seller.editListing.pricingSection.acceptFairPrice",
                    "Use the AI fair price"
                  )}{" "}
                  <span className="font-semibold text-primary">
                    ({formatEGP(mlPricing.fairPrice)})
                  </span>
                </Label>
              </div>

              {/* Custom price input — hidden when acceptFairPrice is checked */}
              {!acceptFairPrice && (
                <FormField
                  label={t("seller.editListing.pricingSection.yourPrice", "Your Price (EGP)")}
                  error={priceError}
                  required
                >
                  <div className="relative">
                    <Tag className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="number"
                      min={1}
                      placeholder={t(
                        "seller.editListing.pricingSection.pricePlaceholder",
                        "e.g. 450000"
                      )}
                      value={customPrice}
                      onChange={(e) => {
                        setCustomPrice(e.target.value);
                        if (priceError) setPriceError("");
                      }}
                      aria-invalid={!!priceError}
                      className="h-11 rounded-xl bg-background/80 ps-9"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(
                      "seller.editListing.pricingSection.rangeHint",
                      "Suggested range: {{lower}} – {{upper}}",
                      {
                        lower: formatEGP(mlPricing.negotiationRangeLower),
                        upper: formatEGP(mlPricing.negotiationRangeUpper),
                      }
                    )}
                  </p>
                </FormField>
              )}

              {/* Set Price CTA */}
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  className="h-12 rounded-xl px-8"
                  disabled={isSettingPrice}
                  onClick={handleSetPrice}
                >
                  {isSettingPrice ? (
                    <>
                      <Loader2 className="mr-2 size-5 animate-spin" />
                      {t("seller.editListing.pricingSection.settingPrice", "Setting price...")}
                    </>
                  ) : (
                    <>
                      <Tag className="mr-2 size-5" />
                      {t("seller.editListing.pricingSection.setPrice", "Set Price")}
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}