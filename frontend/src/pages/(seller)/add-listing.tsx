import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@gp/design-system";
import {
  Upload,
  X,
  ImagePlus,
  Car,
  AlertCircle,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAKES = [
  { id: 1, name: "Toyota" },
  { id: 2, name: "Honda" },
  { id: 3, name: "BMW" },
  { id: 4, name: "Mercedes-Benz" },
  { id: 5, name: "Nissan" },
  { id: 6, name: "Hyundai" },
  { id: 7, name: "Kia" },
  { id: 8, name: "Ford" },
];

const MODELS: Record<number, { id: number; name: string }[]> = {
  1: [{ id: 1, name: "Camry" }, { id: 2, name: "Corolla" }, { id: 3, name: "Land Cruiser" }, { id: 4, name: "RAV4" }],
  2: [{ id: 5, name: "Civic" }, { id: 6, name: "Accord" }, { id: 7, name: "CR-V" }],
  3: [{ id: 8, name: "3 Series" }, { id: 9, name: "5 Series" }, { id: 10, name: "X5" }],
  4: [{ id: 11, name: "C-Class" }, { id: 12, name: "E-Class" }, { id: 13, name: "GLC" }],
  5: [{ id: 14, name: "Patrol" }, { id: 15, name: "Altima" }, { id: 16, name: "X-Trail" }],
  6: [{ id: 17, name: "Tucson" }, { id: 18, name: "Elantra" }, { id: 19, name: "Santa Fe" }],
  7: [{ id: 20, name: "Sportage" }, { id: 21, name: "K5" }, { id: 22, name: "Sorento" }],
  8: [{ id: 23, name: "Mustang" }, { id: 24, name: "Explorer" }, { id: 25, name: "F-150" }],
};

const FUEL_TYPES = ["Gasoline", "Diesel", "Hybrid", "Electric", "Other"];
const TRANSMISSIONS = ["Automatic", "Manual"];
const CONDITION_GRADES = ["A+", "A", "A-", "B+", "B", "C+", "C"];
const COLORS = ["White", "Black", "Silver", "Gray", "Red", "Blue", "Green", "Brown", "Beige", "Other"];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR + 1 - i);

const MIN_IMAGES = 3;
const MAX_IMAGES = 10;

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormState {
  makeId: string;
  modelId: string;
  year: string;
  mileage: string;
  fuelType: string;
  transmission: string;
  engineSize: string;
  color: string;
  description: string;
  listingPrice: string;
  conditionGrade: string;
}

const INITIAL_FORM: FormState = {
  makeId: "",
  modelId: "",
  year: "",
  mileage: "",
  fuelType: "",
  transmission: "",
  engineSize: "",
  color: "",
  description: "",
  listingPrice: "",
  conditionGrade: "",
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const AddListing = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Available models based on selected make
  const availableModels = useMemo(() => {
    const makeId = Number(form.makeId);
    return makeId ? MODELS[makeId] ?? [] : [];
  }, [form.makeId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const updateField = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        // Reset model when make changes
        if (field === "makeId" && value !== prev.makeId) {
          next.modelId = "";
        }
        return next;
      });
      // Clear error for this field when user edits it
      if (submitted) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [submitted]
  );

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const remaining = MAX_IMAGES - images.length;
      const toAdd = files.slice(0, remaining);

      setImages((prev) => [...prev, ...toAdd]);
      const newPreviews = toAdd.map((f) => URL.createObjectURL(f));
      setImagePreviews((prev) => [...prev, ...newPreviews]);

      // Clear image error when user adds images
      if (submitted) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.images;
          return next;
        });
      }

      // Reset file input so user can re-select the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [images.length, submitted]
  );

  const removeImage = useCallback(
    (index: number) => {
      URL.revokeObjectURL(imagePreviews[index]);
      setImages((prev) => prev.filter((_, i) => i !== index));
      setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    },
    [imagePreviews]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length === 0) return;

      const remaining = MAX_IMAGES - images.length;
      const toAdd = files.slice(0, remaining);

      setImages((prev) => [...prev, ...toAdd]);
      const newPreviews = toAdd.map((f) => URL.createObjectURL(f));
      setImagePreviews((prev) => [...prev, ...newPreviews]);

      if (submitted) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.images;
          return next;
        });
      }
    },
    [images.length, submitted]
  );

  // ── Validation ───────────────────────────────────────────────────────────

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};

    if (!form.makeId) errs.makeId = t("seller.addListing.errors.required");
    if (!form.modelId) errs.modelId = t("seller.addListing.errors.required");
    if (!form.year) errs.year = t("seller.addListing.errors.required");
    if (!form.mileage) {
      errs.mileage = t("seller.addListing.errors.required");
    } else if (Number(form.mileage) < 0) {
      errs.mileage = t("seller.addListing.errors.invalidMileage");
    }
    if (!form.fuelType) errs.fuelType = t("seller.addListing.errors.required");
    if (!form.transmission) errs.transmission = t("seller.addListing.errors.required");
    if (!form.engineSize.trim()) errs.engineSize = t("seller.addListing.errors.required");
    if (!form.color) errs.color = t("seller.addListing.errors.required");
    if (!form.description.trim()) {
      errs.description = t("seller.addListing.errors.required");
    } else if (form.description.trim().length < 20) {
      errs.description = t("seller.addListing.errors.descriptionTooShort");
    }
    if (!form.listingPrice) {
      errs.listingPrice = t("seller.addListing.errors.required");
    } else if (Number(form.listingPrice) <= 0) {
      errs.listingPrice = t("seller.addListing.errors.invalidPrice");
    }
    if (!form.conditionGrade) errs.conditionGrade = t("seller.addListing.errors.required");
    if (images.length < MIN_IMAGES) {
      errs.images = t("seller.addListing.errors.minImages", { min: MIN_IMAGES });
    }

    return errs;
  }, [form, images.length, t]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitted(true);

      const validationErrors = validate();
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        toast.error(t("seller.addListing.errors.fixErrors"));
        return;
      }

      // Mock submission
      toast.success(t("seller.addListing.success.title"), {
        description: t("seller.addListing.success.description"),
      });

      // Navigate back to listings after short delay
      setTimeout(() => navigate("/seller/listings"), 1500);
    },
    [validate, t, navigate]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {t("seller.addListing.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("seller.addListing.subtitle")}
        </p>
      </div>

      {/* Images Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="size-4 text-primary" />
            {t("seller.addListing.images.title")}
          </CardTitle>
          <CardDescription>
            {t("seller.addListing.images.description", { min: MIN_IMAGES, max: MAX_IMAGES })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Uploaded image previews */}
          {imagePreviews.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {imagePreviews.map((preview, i) => (
                <div key={i} className="group relative aspect-4/3 overflow-hidden rounded-lg border border-border bg-muted">
                  <img src={preview} alt={`Upload ${i + 1}`} className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/90"
                  >
                    <X className="size-3.5" />
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                      {t("seller.addListing.images.cover")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Drop zone */}
          {images.length < MAX_IMAGES && (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50 hover:bg-muted/50 ${
                errors.images ? "border-destructive bg-destructive/5" : "border-border"
              }`}
            >
              <ImagePlus className="size-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {t("seller.addListing.images.dropzone")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("seller.addListing.images.formats")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {images.length} / {MAX_IMAGES} {t("seller.addListing.images.uploaded")}
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />

          {errors.images && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-3.5" />
              {errors.images}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Vehicle Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Car className="size-4 text-primary" />
            {t("seller.addListing.vehicleInfo.title")}
          </CardTitle>
          <CardDescription>{t("seller.addListing.vehicleInfo.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Make */}
            <FormField label={t("seller.addListing.fields.make")} error={errors.makeId} required>
              <Select value={form.makeId} onValueChange={(v) => updateField("makeId", v)}>
                <SelectTrigger aria-invalid={!!errors.makeId}>
                  <SelectValue placeholder={t("seller.addListing.placeholders.make")} />
                </SelectTrigger>
                <SelectContent>
                  {MAKES.map((make) => (
                    <SelectItem key={make.id} value={make.id.toString()}>
                      {make.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {/* Model */}
            <FormField label={t("seller.addListing.fields.model")} error={errors.modelId} required>
              <Select
                value={form.modelId}
                onValueChange={(v) => updateField("modelId", v)}
                disabled={!form.makeId}
              >
                <SelectTrigger aria-invalid={!!errors.modelId}>
                  <SelectValue placeholder={t("seller.addListing.placeholders.model")} />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id.toString()}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {/* Year */}
            <FormField label={t("seller.addListing.fields.year")} error={errors.year} required>
              <Select value={form.year} onValueChange={(v) => updateField("year", v)}>
                <SelectTrigger aria-invalid={!!errors.year}>
                  <SelectValue placeholder={t("seller.addListing.placeholders.year")} />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
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
              />
            </FormField>

            {/* Fuel Type */}
            <FormField label={t("seller.addListing.fields.fuelType")} error={errors.fuelType} required>
              <Select value={form.fuelType} onValueChange={(v) => updateField("fuelType", v)}>
                <SelectTrigger aria-invalid={!!errors.fuelType}>
                  <SelectValue placeholder={t("seller.addListing.placeholders.fuelType")} />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {/* Transmission */}
            <FormField label={t("seller.addListing.fields.transmission")} error={errors.transmission} required>
              <Select value={form.transmission} onValueChange={(v) => updateField("transmission", v)}>
                <SelectTrigger aria-invalid={!!errors.transmission}>
                  <SelectValue placeholder={t("seller.addListing.placeholders.transmission")} />
                </SelectTrigger>
                <SelectContent>
                  {TRANSMISSIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
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
              />
            </FormField>

            {/* Color */}
            <FormField label={t("seller.addListing.fields.color")} error={errors.color} required>
              <Select value={form.color} onValueChange={(v) => updateField("color", v)}>
                <SelectTrigger aria-invalid={!!errors.color}>
                  <SelectValue placeholder={t("seller.addListing.placeholders.color")} />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((color) => (
                    <SelectItem key={color} value={color}>
                      {color}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {/* Condition Grade */}
            <FormField label={t("seller.addListing.fields.conditionGrade")} error={errors.conditionGrade} required>
              <Select value={form.conditionGrade} onValueChange={(v) => updateField("conditionGrade", v)}>
                <SelectTrigger aria-invalid={!!errors.conditionGrade}>
                  <SelectValue placeholder={t("seller.addListing.placeholders.conditionGrade")} />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_GRADES.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("seller.addListing.pricing.title")}</CardTitle>
          <CardDescription>{t("seller.addListing.pricing.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <FormField label={t("seller.addListing.fields.listingPrice")} error={errors.listingPrice} required>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  placeholder={t("seller.addListing.placeholders.listingPrice")}
                  value={form.listingPrice}
                  onChange={(e) => updateField("listingPrice", e.target.value)}
                  aria-invalid={!!errors.listingPrice}
                  className="pr-14"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                  SAR
                </span>
              </div>
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("seller.addListing.descriptionSection.title")}</CardTitle>
          <CardDescription>{t("seller.addListing.descriptionSection.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FormField label={t("seller.addListing.fields.description")} error={errors.description} required>
            <Textarea
              placeholder={t("seller.addListing.placeholders.description")}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={5}
              aria-invalid={!!errors.description}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {form.description.length} / 20 {t("seller.addListing.minChars")}
            </p>
          </FormField>
        </CardContent>
      </Card>

      <Separator />

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => navigate("/seller/listings")}>
          {t("buttons.cancel")}
        </Button>
        <Button type="submit" className="gap-2">
          <Car className="size-4" />
          {t("seller.addListing.submit")}
        </Button>
      </div>
    </form>
  );
};

// ─── Form Field Wrapper ──────────────────────────────────────────────────────

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
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3" />
          {error}
        </p>
      )}
    </div>
  );
}

export default AddListing;
