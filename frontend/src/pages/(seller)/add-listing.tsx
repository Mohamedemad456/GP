import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  getActiveConditionChecklistCategories,
  type ConditionChecklistCategoryDto,
} from "@/lib/conditionChecklistCategoriesApi";
import {
  getActiveConditionDefects,
  type ConditionDefectDto,
} from "@/lib/conditionDefectsApi";
import { getAllLookups, type LookupGroupDto } from "@/lib/lookupsApi";
import {
  createListing,
  addListingChecklist,
  uploadListingPhotos,
  generateListingPrice,
  submitListing,
  type FuelType,
  type EgyptLocation,
  type TransmissionType,
} from "@/lib/listingsApi";
import { getActiveMakes, type MakeDto } from "@/lib/makesApi";
import { getActiveModels, type ModelDto } from "@/lib/modelsApi";
import {
  Badge,
  Card,
  CardAction,
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
  Combobox,
} from "@gp/design-system";
import {
  Upload,
  X,
  ImagePlus,
  Car,
  AlertCircle,
  ClipboardCheck,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  Camera,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = [
  "White",
  "Black",
  "Silver",
  "Gray",
  "Red",
  "Blue",
  "Green",
  "Brown",
  "Beige",
  "Other",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from(
  { length: CURRENT_YEAR - 1989 },
  (_, i) => CURRENT_YEAR + 1 - i,
);

const MIN_IMAGES = 3;
const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const SECTION_CARD_CLASS =
  "overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-sm shadow-black/5 pt-0";

const SECTION_HEADER_CLASS = "border-b border-border/60 bg-muted/20 pt-3";

const ADD_LISTING_STEPS = ["listing", "conditions", "photos"] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormState {
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
}

interface ConditionSelection {
  categoryId: string;
  categoryName: string;
  defectId: string;
  defectName: string;
}

const INITIAL_FORM: FormState = {
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
};

type AddListingStep = (typeof ADD_LISTING_STEPS)[number];

function getApiErrorMessage(error: unknown): string | undefined {
  const maybeError = error as {
    response?: { data?: { message?: unknown } };
    message?: unknown;
  };

  if (typeof maybeError.response?.data?.message === "string") {
    return maybeError.response.data.message;
  }

  if (typeof maybeError.message === "string") {
    return maybeError.message;
  }

  return undefined;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const AddListing = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());
  const isRtl = i18n.language?.startsWith("ar");

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<AddListingStep>("listing");
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const [isConditionStepComplete, setIsConditionStepComplete] = useState(false);

  // Makes & models from API
  const [makes, setMakes] = useState<MakeDto[]>([]);
  const [allModels, setAllModels] = useState<ModelDto[]>([]);
  const [isLoadingMakes, setIsLoadingMakes] = useState(true);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [lookupGroups, setLookupGroups] = useState<LookupGroupDto[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [conditionCategories, setConditionCategories] = useState<
    ConditionChecklistCategoryDto[]
  >([]);
  const [conditionDefects, setConditionDefects] = useState<
    ConditionDefectDto[]
  >([]);
  const [isLoadingConditionCategories, setIsLoadingConditionCategories] =
    useState(true);
  const [isLoadingConditionDefects, setIsLoadingConditionDefects] =
    useState(true);
  const [selectedConditionCategoryId, setSelectedConditionCategoryId] =
    useState("");
  const [selectedConditionDefectId, setSelectedConditionDefectId] =
    useState("");
  const [selectedConditions, setSelectedConditions] = useState<
    ConditionSelection[]
  >([]);
  
const fetchAllActiveMakes = useCallback(async () => {
  setIsLoadingMakes(true);
  try {
    const res = await getActiveMakes();
    if (!res.success) throw new Error(res.message);
    setMakes(res.data?.data ?? []);
  } catch {
    toast.error(t("seller.addListing.errors.loadMakesFailed"));
  } finally {
    setIsLoadingMakes(false);
  }
}, [t]);

const fetchAllActiveModels = useCallback(async () => {
  setIsLoadingModels(true);
  try {
    const res = await getActiveModels();
    if (!res.success) throw new Error(res.message);
    setAllModels(res.data ?? []);
  } catch {
    toast.error(t("seller.addListing.errors.loadModelsFailed"));
  } finally {
    setIsLoadingModels(false);
  }
}, [t]);

  useEffect(() => {
    fetchAllActiveMakes();
    fetchAllActiveModels();

    getAllLookups()
      .then((groups) => {
        setLookupGroups(groups);
      })
      .catch(() => toast.error(t("seller.addListing.errors.loadLookupsFailed")))
      .finally(() => setIsLoadingLookups(false));

    getActiveConditionChecklistCategories()
      .then((res) => {
        if (res.success) setConditionCategories(res.data ?? []);
      })
      .catch(() =>
        toast.error(
          t("seller.addListing.errors.loadConditionCategoriesFailed"),
        ),
      )
      .finally(() => setIsLoadingConditionCategories(false));

    getActiveConditionDefects()
      .then((res) => {
        if (res.success) setConditionDefects(res.data ?? []);
      })
      .catch(() =>
        toast.error(t("seller.addListing.errors.loadConditionDefectsFailed")),
      )
      .finally(() => setIsLoadingConditionDefects(false));
  }, [fetchAllActiveMakes, fetchAllActiveModels, t]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
      previewUrlsRef.current.clear();
    };
  }, []);

  // Filter models by selected make
  const availableModels = useMemo(
    () =>
      form.makeId ? allModels.filter((m) => m.makeId === form.makeId) : [],
    [allModels, form.makeId],
  );

  const availableConditionDefects = useMemo(
    () =>
      selectedConditionCategoryId
        ? conditionDefects.filter(
            (defect) => defect.categoryId === selectedConditionCategoryId,
          )
        : [],
    [conditionDefects, selectedConditionCategoryId],
  );

  const lookupOptionsByNameKey = useMemo(
    () =>
      lookupGroups.reduce<Record<string, LookupGroupDto["options"]>>(
        (acc, group) => {
          acc[group.nameKey] = group.options;
          return acc;
        },
        {},
      ),
    [lookupGroups],
  );

  const fuelTypeOptions = lookupOptionsByNameKey.fuelTypes ?? [];
  const transmissionOptions = lookupOptionsByNameKey.transmissionTypes ?? [];
  const locationOptions = lookupOptionsByNameKey.locations ?? [];
  const currentStepIndex = ADD_LISTING_STEPS.indexOf(currentStep);

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
    [submitted],
  );

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((file) => {
        if (!file.type.startsWith("image/")) {
          toast.error(t("seller.addListing.errors.invalidImageType"));
          return false;
        }

        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          toast.error(
            t("seller.addListing.errors.imageTooLarge", {
              max: MAX_IMAGE_SIZE_MB,
            }),
          );
          return false;
        }

        return true;
      });
      if (files.length === 0) return;

      const remaining = MAX_IMAGES - images.length;
      const toAdd = files.slice(0, remaining);

      setImages((prev) => [...prev, ...toAdd]);
      const newPreviews = toAdd.map((f) => URL.createObjectURL(f));
      newPreviews.forEach((previewUrl) => previewUrlsRef.current.add(previewUrl));
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
    [images.length, submitted, t],
  );

  const removeImage = useCallback(
    (index: number) => {
      const previewUrl = imagePreviews[index];
      URL.revokeObjectURL(previewUrl);
      previewUrlsRef.current.delete(previewUrl);
      setImages((prev) => prev.filter((_, i) => i !== index));
      setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    },
    [imagePreviews],
  );

  const handleConditionCategoryChange = useCallback((value: string) => {
    setSelectedConditionCategoryId(value);
    setSelectedConditionDefectId("");
    setIsConditionStepComplete(false);
  }, []);

  const handleConditionDefectChange = useCallback(
    (value: string) => {
      const selectedCategory = conditionCategories.find(
        (category) => category.id === selectedConditionCategoryId,
      );
      const selectedDefect = conditionDefects.find(
        (defect) =>
          defect.id === value &&
          defect.categoryId === selectedConditionCategoryId,
      );

      if (!selectedCategory || !selectedDefect) {
        setSelectedConditionDefectId("");
        return;
      }

      setSelectedConditions((prev) => {
        if (prev.some((item) => item.defectId === selectedDefect.id)) {
          return prev;
        }

        return [
          ...prev,
          {
            categoryId: selectedCategory.id,
            categoryName: selectedCategory.name,
            defectId: selectedDefect.id,
            defectName: selectedDefect.itemName,
          },
        ];
      });

      setSelectedConditionDefectId("");
      setIsConditionStepComplete(false);
    },
    [conditionCategories, conditionDefects, selectedConditionCategoryId],
  );

  const removeConditionSelection = useCallback((defectId: string) => {
    setSelectedConditions((prev) =>
      prev.filter((selection) => selection.defectId !== defectId),
    );
    setIsConditionStepComplete(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files).filter((file) => {
        if (!file.type.startsWith("image/")) {
          toast.error(t("seller.addListing.errors.invalidImageType"));
          return false;
        }

        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          toast.error(
            t("seller.addListing.errors.imageTooLarge", {
              max: MAX_IMAGE_SIZE_MB,
            }),
          );
          return false;
        }

        return true;
      });
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
    [images.length, submitted, t],
  );

  // ── Validation ───────────────────────────────────────────────────────────

  const validateListingStep = useCallback(() => {
    const errs: Record<string, string> = {};

    if (!form.makeId) errs.makeId = t("seller.addListing.errors.required");
    if (!form.modelId) errs.modelId = t("seller.addListing.errors.required");
    if (!form.year) errs.year = t("seller.addListing.errors.required");
    if (!form.mileage) {
      errs.mileage = t("seller.addListing.errors.required");
    } else if (Number(form.mileage) <= 0) {
      errs.mileage = t("seller.addListing.errors.invalidMileage");
    }
    if (!form.fuelType) errs.fuelType = t("seller.addListing.errors.required");
    if (!form.transmission)
      errs.transmission = t("seller.addListing.errors.required");
    if (!form.location) errs.location = t("seller.addListing.errors.required");
    if (!form.engineSize.trim())
      errs.engineSize = t("seller.addListing.errors.required");
    if (!form.color) errs.color = t("seller.addListing.errors.required");
    if (!form.description.trim()) {
      errs.description = t("seller.addListing.errors.required");
    } else if (form.description.trim().length < 20) {
      errs.description = t("seller.addListing.errors.descriptionTooShort");
    }
    if (!form.contactPhoneNumber.trim()) {
      errs.contactPhoneNumber = t("seller.addListing.errors.required");
    }
    if (!form.preferredContactMethod) {
      errs.preferredContactMethod = t("seller.addListing.errors.required");
    }

    return errs;
  }, [form, t]);

  const validatePhotosStep = useCallback(() => {
    const errs: Record<string, string> = {};

    if (images.length < MIN_IMAGES) {
      errs.images = t("seller.addListing.errors.minImages", {
        min: MIN_IMAGES,
      });
    } else if (images.some((image) => image.size > MAX_IMAGE_SIZE_BYTES)) {
      errs.images = t("seller.addListing.errors.imageTooLarge", {
        max: MAX_IMAGE_SIZE_MB,
      });
    }

    return errs;
  }, [images.length, t]);

  const handleListingStepSubmit = useCallback(async () => {
    setSubmitted(true);

    const validationErrors = validateListingStep();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      toast.error(t("seller.addListing.errors.fixErrors"));
      return;
    }

    if (createdListingId) {
      setCurrentStep("conditions");
      return;
    }

    setIsSubmitting(true);

    try {
      const createResult = await createListing({
        makeId: form.makeId,
        modelId: form.modelId,
        year: parseInt(form.year, 10),
        mileage: parseInt(form.mileage, 10),
        fuelType: parseInt(form.fuelType, 10) as FuelType,
        transmission: parseInt(form.transmission, 10) as TransmissionType,
        location: parseInt(form.location, 10) as EgyptLocation,
        engineSize: parseFloat(form.engineSize),
        color: form.color,
        description: form.description.trim(),
        contactPhoneNumber: form.contactPhoneNumber.trim(),
        whatsAppNumber: form.whatsAppNumber.trim(),
        preferredContactMethod: parseInt(form.preferredContactMethod, 10),
      });

      if (!createResult.success || !createResult.data) {
        toast.error(t("seller.addListing.errors.submitFailed"), {
          description: createResult.message,
        });
        return;
      }

      setCreatedListingId(createResult.data.id);
      setErrors({});
      setSubmitted(false);
      toast.success(t("seller.addListing.steps.listing.created"));
      setCurrentStep("conditions");
    } catch (error) {
      toast.error(t("seller.addListing.errors.submitFailed"), {
        description: getApiErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [createdListingId, form, t, validateListingStep]);

  const handleConditionStepSubmit = useCallback(async () => {
    if (!createdListingId) {
      toast.error(t("seller.addListing.errors.createListingFirst"));
      setCurrentStep("listing");
      return;
    }

    setIsSubmitting(true);

    try {
      if (selectedConditions.length === 0) {
        toast.error(t("seller.addListing.conditionChecklist.emptySelections"));
        return;
      }

      const checklistResult = await addListingChecklist(createdListingId, {
        conditionDefectIds: selectedConditions.map((c) => c.defectId),
      });

      if (!checklistResult.success) {
        toast.error(t("seller.addListing.errors.checklistFailed"), {
          description: checklistResult.message,
        });
        return;
      }

      setIsConditionStepComplete(true);
      setSubmitted(false);
      setCurrentStep("photos");
    } catch (error) {
      toast.error(t("seller.addListing.errors.checklistFailed"), {
        description: getApiErrorMessage(error),
      });
      return;
    } finally {
      setIsSubmitting(false);
    }
  }, [createdListingId, selectedConditions, t]);

  const handlePhotosStepSubmit = useCallback(async () => {
    if (!createdListingId) {
      toast.error(t("seller.addListing.errors.createListingFirst"));
      setCurrentStep("listing");
      return;
    }

    setSubmitted(true);

    const validationErrors = validatePhotosStep();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      toast.error(t("seller.addListing.errors.fixErrors"));
      return;
    }

    setIsSubmitting(true);

    try {
      const photosResult = await uploadListingPhotos(createdListingId, images);

      if (!photosResult.success) {
        toast.error(t("seller.addListing.errors.photosFailed"), {
          description: photosResult.message,
        });
        return;
      }

      const priceResult = await generateListingPrice(createdListingId);
      if (!priceResult.success) {
        toast.error(t("seller.addListing.errors.submitFailed"), {
          description: priceResult.message,
        });
        return;
      }

      const submitResult = await submitListing(createdListingId);
      if (!submitResult.success) {
        toast.error(t("seller.addListing.errors.submitFailed"), {
          description: submitResult.message,
        });
        return;
      }

      toast.success(t("seller.addListing.success.title"), {
        description: t("seller.addListing.success.description"),
      });

      navigate("/seller/listings");
    } catch (error) {
      toast.error(t("seller.addListing.errors.submitFailed"), {
        description: getApiErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [createdListingId, images, navigate, t, validatePhotosStep]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (currentStep === "listing") {
        await handleListingStepSubmit();
        return;
      }

      if (currentStep === "conditions") {
        await handleConditionStepSubmit();
        return;
      }

      await handlePhotosStepSubmit();
    },
    [
      currentStep,
      handleConditionStepSubmit,
      handleListingStepSubmit,
      handlePhotosStepSubmit,
    ],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto space-y-8 pb-10"
      dir={isRtl ? "rtl" : "ltr"}
      noValidate
    >
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-linear-to-br from-background via-background to-muted/40 p-6 shadow-sm shadow-black/5 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/30 to-transparent" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner shadow-primary/10">
              <Sparkles className="size-5" />
            </div>
            <div className="space-y-2">
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t("seller.addListing.title")}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {t("seller.addListing.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {ADD_LISTING_STEPS.map((step, index) => {
          const isActive = currentStep === step;
          const isComplete =
            (step === "listing" && !!createdListingId) ||
            (step === "conditions" && isConditionStepComplete);
          const Icon =
            step === "listing"
              ? Car
              : step === "conditions"
                ? ClipboardCheck
                : Camera;

          return (
            <button
              key={step}
              type="button"
              disabled={
                step === "conditions"
                  ? !createdListingId
                  : step === "photos"
                    ? !isConditionStepComplete
                    : false
              }
              onClick={() => {
                if (step === "listing" && createdListingId) return;
                if (step === "listing" || createdListingId) {
                  if (step !== "photos" || isConditionStepComplete) {
                    setCurrentStep(step);
                  }
                }
              }}
              className={`group flex items-center gap-4 rounded-3xl border p-4 text-start transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-55 rtl:text-right ${
                isActive
                  ? "border-primary/35 bg-primary/[0.07] shadow-sm shadow-primary/10"
                  : "border-border/70 bg-card/80 hover:border-primary/25 hover:bg-muted/30"
              }`}
            >
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1 transition-colors ${
                  isComplete
                    ? "bg-primary text-primary-foreground ring-primary/20"
                    : isActive
                      ? "bg-background text-primary ring-primary/20"
                      : "bg-muted text-muted-foreground ring-border/60"
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <Icon className="size-5" />
                )}
              </span>
              <span className="min-w-0 space-y-1">
                <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground rtl:tracking-normal">
                  {t("seller.addListing.steps.stepLabel", {
                    number: index + 1,
                  })}
                </span>
                <span className="block truncate text-sm font-semibold text-foreground">
                  {t(`seller.addListing.steps.${step}.title`)}
                </span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  {t(`seller.addListing.steps.${step}.description`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Images Section */}
      {currentStep === "photos" && (
      <Card className={SECTION_CARD_CLASS}>
        <CardHeader className={SECTION_HEADER_CLASS}>
          <CardTitle className="flex items-center gap-3 text-base">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Upload className="size-4" />
            </span>
            {t("seller.addListing.images.title")}
          </CardTitle>
          <CardAction>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {images.length} / {MAX_IMAGES}
            </Badge>
          </CardAction>
          <CardDescription>
                {t("seller.addListing.images.description", {
                  min: MIN_IMAGES,
                  max: MAX_IMAGES,
                  maxSize: MAX_IMAGE_SIZE_MB,
                })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {/* Uploaded image previews */}
          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {imagePreviews.map((preview, i) => (
                <div
                  key={i}
                  className="group relative aspect-4/3 overflow-hidden rounded-2xl border border-border/60 bg-muted shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <img
                    src={preview}
                    alt={`Upload ${i + 1}`}
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow-sm backdrop-blur transition-all group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
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
              className={`group flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-all hover:border-primary/50 hover:bg-primary/5 ${
                errors.images
                  ? "border-destructive bg-destructive/5"
                  : "border-border/70 bg-muted/20"
              }`}
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-background text-primary shadow-sm ring-1 ring-border/60 transition-transform duration-200 group-hover:scale-105">
                <ImagePlus className="size-6" />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">
                {t("seller.addListing.images.dropzone")}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("seller.addListing.images.formats", {
                  maxSize: MAX_IMAGE_SIZE_MB,
                })}
              </p>
              <p className="mt-2 inline-flex items-center rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border/60">
                {images.length} / {MAX_IMAGES}{" "}
                {t("seller.addListing.images.uploaded")}
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
      )}

      {/* Vehicle Information */}
      {currentStep === "listing" && (
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
            <FormField
              label={t("seller.addListing.fields.make")}
              error={errors.makeId}
              required
            >
              <Combobox
                value={form.makeId}
                onValueChange={(v) => updateField("makeId", v)}
                options={makes.map((m) => ({ value: m.id, label: m.name }))}
                placeholder={
                  isLoadingMakes
                    ? t("seller.addListing.placeholders.loading")
                    : t("seller.addListing.placeholders.make")
                }
                searchPlaceholder={t(
                  "seller.addListing.placeholders.searchMake",
                )}
                emptyText={t("seller.addListing.placeholders.noMakeFound")}
                disabled={isLoadingMakes}
                aria-invalid={!!errors.makeId}
              />
            </FormField>

            {/* Model */}
            <FormField
              label={t("seller.addListing.fields.model")}
              error={errors.modelId}
              required
            >
              <Combobox
                value={form.modelId}
                onValueChange={(v) => updateField("modelId", v)}
                options={availableModels.map((m) => ({
                  value: m.id,
                  label: m.name,
                }))}
                placeholder={
                  isLoadingModels
                    ? t("seller.addListing.placeholders.loading")
                    : !form.makeId
                      ? t("seller.addListing.placeholders.selectMakeFirst")
                      : t("seller.addListing.placeholders.model")
                }
                searchPlaceholder={t(
                  "seller.addListing.placeholders.searchModel",
                )}
                emptyText={t("seller.addListing.placeholders.noModelFound")}
                disabled={!form.makeId || isLoadingModels}
                aria-invalid={!!errors.modelId}
              />
            </FormField>

            {/* Year */}
            <FormField
              label={t("seller.addListing.fields.year")}
              error={errors.year}
              required
            >
              <Select
                value={form.year}
                onValueChange={(v) => updateField("year", v)}
              >
                <SelectTrigger
                  aria-invalid={!!errors.year}
                  className="h-11 rounded-xl bg-background/80"
                >
                  <SelectValue
                    placeholder={t("seller.addListing.placeholders.year")}
                  />
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
            <FormField
              label={t("seller.addListing.fields.mileage")}
              error={errors.mileage}
              required
            >
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
            <FormField
              label={t("seller.addListing.fields.fuelType")}
              error={errors.fuelType}
              required
            >
              <Select
                value={form.fuelType}
                onValueChange={(v) => updateField("fuelType", v)}
              >
                <SelectTrigger
                  aria-invalid={!!errors.fuelType}
                  className="h-11 rounded-xl bg-background/80"
                >
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
                    <SelectItem key={type.value} value={type.value.toString()}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {/* Transmission */}
            <FormField
              label={t("seller.addListing.fields.transmission")}
              error={errors.transmission}
              required
            >
              <Select
                value={form.transmission}
                onValueChange={(v) => updateField("transmission", v)}
              >
                <SelectTrigger
                  aria-invalid={!!errors.transmission}
                  className="h-11 rounded-xl bg-background/80"
                >
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
                    <SelectItem key={type.value} value={type.value.toString()}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {/* Location */}
            <FormField
              label={t("seller.addListing.fields.location")}
              error={errors.location}
              required
            >
              <Select
                value={form.location}
                onValueChange={(v) => updateField("location", v)}
                disabled={isLoadingLookups}
              >
                <SelectTrigger
                  aria-invalid={!!errors.location}
                  className="h-11 rounded-xl bg-background/80"
                >
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
                    <SelectItem key={loc.value} value={loc.value.toString()}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {/* Engine Size */}
            <FormField
              label={t("seller.addListing.fields.engineSize")}
              error={errors.engineSize}
              required
            >
              <Input
                placeholder={t("seller.addListing.placeholders.engineSize")}
                value={form.engineSize}
                onChange={(e) => updateField("engineSize", e.target.value)}
                aria-invalid={!!errors.engineSize}
                className="h-11 rounded-xl bg-background/80"
              />
            </FormField>

            {/* Color */}
            <FormField
              label={t("seller.addListing.fields.color")}
              error={errors.color}
              required
            >
              <Select
                value={form.color}
                onValueChange={(v) => updateField("color", v)}
              >
                <SelectTrigger
                  aria-invalid={!!errors.color}
                  className="h-11 rounded-xl bg-background/80"
                >
                  <SelectValue
                    placeholder={t("seller.addListing.placeholders.color")}
                  />
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

          </div>
        </CardContent>
      </Card>
      )}

      {/* Condition Checklist */}
      {currentStep === "conditions" && (
      <Card className={SECTION_CARD_CLASS}>
        <CardHeader className={SECTION_HEADER_CLASS}>
          <CardTitle className="flex items-center gap-3 text-base">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardCheck className="size-4" />
            </span>
            {t("seller.addListing.conditionChecklist.title")}
          </CardTitle>
          <CardAction>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {t("seller.addListing.conditionChecklist.selectedCount", {
                count: selectedConditions.length,
              })}
            </Badge>
          </CardAction>
          <CardDescription>
            {t("seller.addListing.conditionChecklist.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormField label={t("seller.addListing.fields.conditionCategory")}>
              <Select
                value={selectedConditionCategoryId}
                onValueChange={handleConditionCategoryChange}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background/80">
                  <SelectValue
                    placeholder={
                      isLoadingConditionCategories
                        ? t("seller.addListing.placeholders.loading")
                        : t("seller.addListing.placeholders.conditionCategory")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {conditionCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label={t("seller.addListing.fields.conditionDefect")}>
              <Select
                value={selectedConditionDefectId}
                onValueChange={handleConditionDefectChange}
                disabled={
                  !selectedConditionCategoryId || isLoadingConditionDefects
                }
              >
                <SelectTrigger className="h-11 rounded-xl bg-background/80">
                  <SelectValue
                    placeholder={
                      isLoadingConditionDefects
                        ? t("seller.addListing.placeholders.loading")
                        : !selectedConditionCategoryId
                          ? t(
                              "seller.addListing.placeholders.selectConditionCategoryFirst",
                            )
                          : t("seller.addListing.placeholders.conditionDefect")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableConditionDefects.map((defect) => (
                    <SelectItem key={defect.id} value={defect.id}>
                      {defect.itemName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">
                {t("seller.addListing.conditionChecklist.selectedTitle")}
              </p>
              {selectedConditionCategoryId && (
                <span className="text-xs text-muted-foreground">
                  {t("seller.addListing.conditionChecklist.availableDefects", {
                    count: availableConditionDefects.length,
                  })}
                </span>
              )}
            </div>

            {selectedConditions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedConditions.map((selection) => (
                  <div
                    key={selection.defectId}
                    className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-2 text-sm text-foreground shadow-xs"
                  >
                    <span className="text-xs text-muted-foreground">
                      {selection.categoryName}
                    </span>
                    <span className="size-1 rounded-full bg-border" />
                    <span className="font-medium">{selection.defectName}</span>
                    <button
                      type="button"
                      onClick={() =>
                        removeConditionSelection(selection.defectId)
                      }
                      className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                      aria-label={t(
                        "seller.addListing.conditionChecklist.removeSelection",
                        {
                          defect: selection.defectName,
                        },
                      )}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                {t("seller.addListing.conditionChecklist.emptySelections")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Description */}
      {currentStep === "listing" && (
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
      )}

      {/* Contact Information */}
      {currentStep === "listing" && (
      <Card className={SECTION_CARD_CLASS}>
        <CardHeader className={SECTION_HEADER_CLASS}>
          <CardTitle className="flex items-center gap-3 text-base">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="size-4" />
            </span>
            {t("seller.addListing.contactInfo.title")}
          </CardTitle>
          <CardDescription>
            {t("seller.addListing.contactInfo.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField
              label={t("seller.addListing.fields.contactPhoneNumber")}
              error={errors.contactPhoneNumber}
              required
            >
              <Input
                placeholder={t("seller.addListing.placeholders.contactPhoneNumber")}
                value={form.contactPhoneNumber}
                onChange={(e) => updateField("contactPhoneNumber", e.target.value)}
                aria-invalid={!!errors.contactPhoneNumber}
                className="h-11 rounded-xl bg-background/80"
              />
            </FormField>

            <FormField
              label={t("seller.addListing.fields.whatsAppNumber")}
              error={errors.whatsAppNumber}
            >
              <Input
                placeholder={t("seller.addListing.placeholders.whatsAppNumber")}
                value={form.whatsAppNumber}
                onChange={(e) => updateField("whatsAppNumber", e.target.value)}
                aria-invalid={!!errors.whatsAppNumber}
                className="h-11 rounded-xl bg-background/80"
              />
            </FormField>

            <FormField
              label={t("seller.addListing.fields.preferredContactMethod")}
              error={errors.preferredContactMethod}
              required
            >
              <Select
                value={form.preferredContactMethod}
                onValueChange={(v) => updateField("preferredContactMethod", v)}
              >
                <SelectTrigger
                  aria-invalid={!!errors.preferredContactMethod}
                  className="h-11 rounded-xl bg-background/80"
                >
                  <SelectValue
                    placeholder={t("seller.addListing.placeholders.preferredContactMethod")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("seller.addListing.contactMethods.phone")}</SelectItem>
                  <SelectItem value="2">{t("seller.addListing.contactMethods.whatsapp")}</SelectItem>
                  <SelectItem value="3">{t("seller.addListing.contactMethods.both")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </CardContent>
      </Card>
      )}

      <Separator className="opacity-60" />

      {/* Actions */}
      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-3xl border border-border/70 bg-background/90 p-4 shadow-lg shadow-black/5 backdrop-blur supports-backdrop-filter:bg-background/80 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("seller.addListing.steps.footer", {
            current: currentStepIndex + 1,
            total: ADD_LISTING_STEPS.length,
          })}
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              currentStep === "photos"
                ? setCurrentStep("conditions")
                : navigate("/seller/listings")
            }
            disabled={isSubmitting}
            className="rounded-xl"
          >
            {currentStep === "photos"
              ? t("buttons.back", "Back")
              : t("buttons.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2 rounded-xl px-5 shadow-sm shadow-primary/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("seller.addListing.submitting", "Submitting…")}
              </>
            ) : (
              <>
                {currentStep === "listing" ? (
                  <Car className="size-4" />
                ) : currentStep === "conditions" ? (
                  <ClipboardCheck className="size-4" />
                ) : (
                  <Camera className="size-4" />
                )}
                {currentStep === "photos"
                  ? t("seller.addListing.submit")
                  : t("seller.addListing.steps.continue")}
              </>
            )}
          </Button>
        </div>
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
    <div className="space-y-2">
      <Label className="inline-flex items-center gap-1 text-sm font-medium text-foreground/90">
        <span>{label}</span>
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="size-3" />
          {error}
        </p>
      )}
    </div>
  );
}

export default AddListing;
