import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  FolderTree,
  Info,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";

import {
  Badge,
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  PaginationBar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@gp/design-system";
import { useToast } from "@/hooks/use-toast";
import {
  activateConditionChecklistCategory,
  createConditionChecklistCategory,
  deactivateConditionChecklistCategory,
  deleteConditionChecklistCategory,
  getAllConditionChecklistCategories,
  updateConditionChecklistCategory,
  type AdminConditionChecklistCategoryDto,
  type CreateConditionChecklistCategoryRequest,
} from "@/lib/conditionChecklistCategoriesApi";
import {
  activateConditionDefect,
  createConditionDefect,
  deactivateConditionDefect,
  deleteConditionDefect,
  getAllConditionDefects,
  updateConditionDefect,
  type AdminConditionDefectDto,
  type CreateConditionDefectRequest,
} from "@/lib/conditionDefectsApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryFormState = { name: string; nameAr: string };
type DefectFormState = {
  itemName: string;
  itemNameAr: string;
  description: string;
  descriptionAr: string;
  categoryId: string;
};
type StatusFilter = "all" | "true" | "false";

const EMPTY_CATEGORY_FORM: CategoryFormState = { name: "", nameAr: "" };
const EMPTY_DEFECT_FORM: DefectFormState = {
  itemName: "",
  itemNameAr: "",
  description: "",
  descriptionAr: "",
  categoryId: "",
};

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;
const arabicFontStyle = {
  fontFamily: "'Cairo', 'Tajawal', 'IBM Plex Arabic', sans-serif",
} as const;

const getUpdatedAt = (updatedAt: string | null, createdAt: string) =>
  updatedAt ?? createdAt;

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Layers3;
  label: string;
  value: number;
  tone: "primary" | "success" | "warning" | "muted";
}) {
  const toneClasses =
    tone === "primary"
      ? "bg-primary/10 text-primary ring-primary/15"
      : tone === "success"
        ? "bg-success/10 text-success ring-success/15"
        : tone === "warning"
          ? "bg-warning/10 text-warning ring-warning/15"
          : "bg-muted text-muted-foreground ring-border/60";

  return (
    <div className="rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground/75">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset ${toneClasses}`}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <Badge
      variant={active ? "success" : "secondary"}
      className="rounded-full px-2.5 py-1 font-medium"
    >
      {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}

// ─── Conditions ───────────────────────────────────────────────────────────────

const Conditions = () => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith("ar");
  const { success, error } = useToast();

  // ── Category data ────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<AdminConditionChecklistCategoryDto[]>([]);
  const [categoriesForSelect, setCategoriesForSelect] = useState<AdminConditionChecklistCategoryDto[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryTotal, setCategoryTotal] = useState(0);

  // ── Category filters (server-side) ───────────────────────────────────────
  const [categorySearchInput, setCategorySearchInput] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<StatusFilter>("all");
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(5);

  // ── Defect data ──────────────────────────────────────────────────────────
  const [defects, setDefects] = useState<AdminConditionDefectDto[]>([]);
  const [defectsLoading, setDefectsLoading] = useState(true);
  const [defectTotal, setDefectTotal] = useState(0);

  // ── Defect filters (server-side) ─────────────────────────────────────────
  const [defectSearchInput, setDefectSearchInput] = useState("");
  const [defectSearch, setDefectSearch] = useState("");
  const [defectStatusFilter, setDefectStatusFilter] = useState<StatusFilter>("all");
  const [defectCategoryFilter, setDefectCategoryFilter] = useState("all");
  const [defectPage, setDefectPage] = useState(1);
  const [defectPageSize, setDefectPageSize] = useState(10);

  // ── Category dialog state ─────────────────────────────────────────────────
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminConditionChecklistCategoryDto | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [isCategorySaving, setIsCategorySaving] = useState(false);
  const [categoryDeleteTarget, setCategoryDeleteTarget] = useState<AdminConditionChecklistCategoryDto | null>(null);
  const [isCategoryDeleting, setIsCategoryDeleting] = useState(false);

  // ── Defect dialog state ───────────────────────────────────────────────────
  const [defectDialogOpen, setDefectDialogOpen] = useState(false);
  const [editingDefect, setEditingDefect] = useState<AdminConditionDefectDto | null>(null);
  const [defectForm, setDefectForm] = useState<DefectFormState>(EMPTY_DEFECT_FORM);
  const [isDefectSaving, setIsDefectSaving] = useState(false);
  const [defectDeleteTarget, setDefectDeleteTarget] = useState<AdminConditionDefectDto | null>(null);
  const [isDefectDeleting, setIsDefectDeleting] = useState(false);

  // ── Computed ──────────────────────────────────────────────────────────────
  const categoryTotalPages = Math.max(1, Math.ceil(categoryTotal / categoryPageSize));
  const defectTotalPages = Math.max(1, Math.ceil(defectTotal / defectPageSize));
  const categoriesEmpty = !categoriesLoading && categories.length === 0;
  const defectsEmpty = !defectsLoading && defects.length === 0;

  // ── Localization helpers ──────────────────────────────────────────────────
  const formatDate = useCallback(
    (value: string | null) => {
      if (!value) return "—";
      return new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value));
    },
    [isArabic],
  );

  const getLocalizedCategoryName = useCallback(
    (category: AdminConditionChecklistCategoryDto) =>
      isArabic ? category.nameAr || category.name : category.name || category.nameAr,
    [isArabic],
  );

  const getLocalizedDefectName = useCallback(
    (defect: AdminConditionDefectDto) =>
      isArabic ? defect.itemNameAr || defect.itemName : defect.itemName || defect.itemNameAr,
    [isArabic],
  );

  const getLocalizedDefectCategoryName = useCallback(
    (defect: AdminConditionDefectDto) =>
      isArabic ? defect.categoryNameAr || defect.categoryName : defect.categoryName || defect.categoryNameAr,
    [isArabic],
  );

  const getLocalizedDefectDescription = useCallback(
    (defect: AdminConditionDefectDto) =>
      isArabic ? defect.descriptionAr ?? defect.description ?? "" : defect.description ?? defect.descriptionAr ?? "",
    [isArabic],
  );

  // ── Search debounce ───────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setCategorySearch(categorySearchInput);
      setCategoryPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [categorySearchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDefectSearch(defectSearchInput);
      setDefectPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [defectSearchInput]);

  // ── Fetch categories for select/combobox (all pages) ─────────────────────
  const fetchAllCategoriesForSelect = useCallback(async () => {
    try {
      const all: AdminConditionChecklistCategoryDto[] = [];
      let pageIndex = 1;
      let total = 0;
      do {
        const res = await getAllConditionChecklistCategories({ pageIndex, pageSize: 10 });
        if (!res.success) break;
        all.push(...res.data);
        total = res.totalCount;
        pageIndex++;
      } while (all.length < total);
      setCategoriesForSelect(all);
    } catch {
      // non-critical — comboboxes will just be empty
    }
  }, []);

  // ── Fetch categories (server-side paginated) ──────────────────────────────
  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const res = await getAllConditionChecklistCategories({
        pageIndex: categoryPage,
        pageSize: categoryPageSize,
        ...(categorySearch ? { search: categorySearch } : {}),
        ...(categoryStatusFilter !== "all"
          ? { isActive: categoryStatusFilter === "true" }
          : {}),
      });
      if (res.success) {
        setCategories(res.data ?? []);
        setCategoryTotal(res.totalCount ?? 0);
      } else {
        error(t("admin.conditions.loadCategoriesError"), { description: res.message });
      }
    } catch {
      error(t("admin.conditions.loadCategoriesError"));
    } finally {
      setCategoriesLoading(false);
    }
  }, [categoryPage, categoryPageSize, categorySearch, categoryStatusFilter, error, t]);

  // ── Fetch defects (server-side paginated) ─────────────────────────────────
  const fetchDefects = useCallback(async () => {
    setDefectsLoading(true);
    try {
      const res = await getAllConditionDefects({
        pageIndex: defectPage,
        pageSize: defectPageSize,
        ...(defectSearch ? { search: defectSearch } : {}),
        ...(defectStatusFilter !== "all"
          ? { isActive: defectStatusFilter === "true" }
          : {}),
        ...(defectCategoryFilter !== "all" ? { categoryId: defectCategoryFilter } : {}),
      });
      if (res.success) {
        setDefects(res.data ?? []);
        setDefectTotal(res.totalCount ?? 0);
      } else {
        error(t("admin.conditions.loadDefectsError"), { description: res.message });
      }
    } catch {
      error(t("admin.conditions.loadDefectsError"));
    } finally {
      setDefectsLoading(false);
    }
  }, [defectPage, defectPageSize, defectSearch, defectStatusFilter, defectCategoryFilter, error, t]);

  useEffect(() => { void fetchCategories(); }, [fetchCategories]);
  useEffect(() => { void fetchDefects(); }, [fetchDefects]);
  useEffect(() => { void fetchAllCategoriesForSelect(); }, [fetchAllCategoriesForSelect]);

  // Guard: reset to last valid page when total shrinks
  useEffect(() => {
    if (categoryPage > categoryTotalPages) setCategoryPage(categoryTotalPages);
  }, [categoryPage, categoryTotalPages]);

  useEffect(() => {
    if (defectPage > defectTotalPages) setDefectPage(defectTotalPages);
  }, [defectPage, defectTotalPages]);

  // ── Combobox options (from all categories, not just current page) ─────────
  const categoryOptions = categoriesForSelect.map((category) => ({
    value: category.id,
    label: getLocalizedCategoryName(category),
    disabled: false,
  }));

  // ── Dialog: open/close ────────────────────────────────────────────────────
  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setCategoryDialogOpen(true);
  };

  const openEditCategory = (category: AdminConditionChecklistCategoryDto) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, nameAr: category.nameAr });
    setCategoryDialogOpen(true);
  };

  const openCreateDefect = () => {
    setEditingDefect(null);
    setDefectForm({
      ...EMPTY_DEFECT_FORM,
      categoryId:
        defectCategoryFilter !== "all" ? defectCategoryFilter : EMPTY_DEFECT_FORM.categoryId,
    });
    setDefectDialogOpen(true);
  };

  const openEditDefect = (defect: AdminConditionDefectDto) => {
    setEditingDefect(defect);
    setDefectForm({
      itemName: defect.itemName,
      itemNameAr: defect.itemNameAr,
      description: defect.description ?? "",
      descriptionAr: defect.descriptionAr ?? "",
      categoryId: defect.categoryId,
    });
    setDefectDialogOpen(true);
  };

  // ── Field change handlers ─────────────────────────────────────────────────
  const handleCategoryFieldChange =
    (field: keyof CategoryFormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setCategoryForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleDefectInputChange =
    (field: keyof Omit<DefectFormState, "categoryId">) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDefectForm((prev) => ({ ...prev, [field]: event.target.value }));

  // ── Save handlers ─────────────────────────────────────────────────────────
  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim() || !categoryForm.nameAr.trim()) {
      error(t("admin.conditions.categoryNameRequired"));
      return;
    }
    setIsCategorySaving(true);
    try {
      const payload: CreateConditionChecklistCategoryRequest = {
        name: categoryForm.name.trim(),
        nameAr: categoryForm.nameAr.trim(),
      };
      const response = editingCategory
        ? await updateConditionChecklistCategory(editingCategory.id, payload)
        : await createConditionChecklistCategory(payload);

      if (response.success) {
        success(
          editingCategory
            ? t("admin.conditions.updateCategorySuccess")
            : t("admin.conditions.createCategorySuccess"),
        );
        await Promise.all([
          fetchCategories(),
          fetchDefects(),
          fetchAllCategoriesForSelect(),
        ]);
        setCategoryDialogOpen(false);
      } else {
        error(
          editingCategory
            ? t("admin.conditions.updateCategoryError")
            : t("admin.conditions.createCategoryError"),
          { description: response.message },
        );
      }
    } catch {
      error(
        editingCategory
          ? t("admin.conditions.updateCategoryError")
          : t("admin.conditions.createCategoryError"),
      );
    } finally {
      setIsCategorySaving(false);
    }
  };

  const handleSaveDefect = async () => {
    if (!defectForm.itemName.trim() || !defectForm.itemNameAr.trim()) {
      error(t("admin.conditions.defectNameRequired"));
      return;
    }
    if (!defectForm.categoryId) {
      error(t("admin.conditions.defectCategoryRequired"));
      return;
    }
    setIsDefectSaving(true);
    try {
      const payload: CreateConditionDefectRequest = {
        itemName: defectForm.itemName.trim(),
        itemNameAr: defectForm.itemNameAr.trim(),
        description: defectForm.description.trim() || undefined,
        descriptionAr: defectForm.descriptionAr.trim() || undefined,
        categoryId: defectForm.categoryId,
      };
      const response = editingDefect
        ? await updateConditionDefect(editingDefect.id, payload)
        : await createConditionDefect(payload);

      if (response.success) {
        success(
          editingDefect
            ? t("admin.conditions.updateDefectSuccess")
            : t("admin.conditions.createDefectSuccess"),
        );
        await fetchDefects();
        setDefectDialogOpen(false);
      } else {
        error(
          editingDefect
            ? t("admin.conditions.updateDefectError")
            : t("admin.conditions.createDefectError"),
          { description: response.message },
        );
      }
    } catch {
      error(
        editingDefect
          ? t("admin.conditions.updateDefectError")
          : t("admin.conditions.createDefectError"),
      );
    } finally {
      setIsDefectSaving(false);
    }
  };

  // ── Toggle active handlers ─────────────────────────────────────────────────
  const handleToggleCategoryActive = async (
    category: AdminConditionChecklistCategoryDto,
  ) => {
    try {
      const response = category.isActive
        ? await deactivateConditionChecklistCategory(category.id)
        : await activateConditionChecklistCategory(category.id);

      if (response.success) {
        success(
          category.isActive
            ? t("admin.conditions.categoryDeactivated")
            : t("admin.conditions.categoryActivated"),
        );
        await Promise.all([fetchCategories(), fetchDefects()]);
      } else {
        error(t("admin.conditions.categoryToggleError"), { description: response.message });
      }
    } catch {
      error(t("admin.conditions.categoryToggleError"));
    }
  };

  const handleToggleDefectActive = async (defect: AdminConditionDefectDto) => {
    try {
      const response = defect.isActive
        ? await deactivateConditionDefect(defect.id)
        : await activateConditionDefect(defect.id);

      if (response.success) {
        success(
          defect.isActive
            ? t("admin.conditions.defectDeactivated")
            : t("admin.conditions.defectActivated"),
        );
        await fetchDefects();
      } else {
        error(t("admin.conditions.defectToggleError"), { description: response.message });
      }
    } catch {
      error(t("admin.conditions.defectToggleError"));
    }
  };

  // ── Delete handlers ───────────────────────────────────────────────────────
  const handleDeleteCategory = async () => {
    if (!categoryDeleteTarget) return;
    setIsCategoryDeleting(true);
    try {
      const response = await deleteConditionChecklistCategory(categoryDeleteTarget.id);
      if (response.success) {
        success(t("admin.conditions.deleteCategorySuccess"));
        setCategoryDeleteTarget(null);
        await Promise.all([fetchCategories(), fetchDefects(), fetchAllCategoriesForSelect()]);
      } else {
        error(t("admin.conditions.deleteCategoryError"), { description: response.message });
      }
    } catch {
      error(t("admin.conditions.deleteCategoryError"));
    } finally {
      setIsCategoryDeleting(false);
    }
  };

  const handleDeleteDefect = async () => {
    if (!defectDeleteTarget) return;
    setIsDefectDeleting(true);
    try {
      const response = await deleteConditionDefect(defectDeleteTarget.id);
      if (response.success) {
        success(t("admin.conditions.deleteDefectSuccess"));
        setDefectDeleteTarget(null);
        await fetchDefects();
      } else {
        error(t("admin.conditions.deleteDefectError"), { description: response.message });
      }
    } catch {
      error(t("admin.conditions.deleteDefectError"));
    } finally {
      setIsDefectDeleting(false);
    }
  };

  // ── Clear filter helpers ───────────────────────────────────────────────────
  const clearCategoryFilters = () => {
    setCategorySearchInput("");
    setCategorySearch("");
    setCategoryStatusFilter("all");
    setCategoryPage(1);
  };

  const clearDefectFilters = () => {
    setDefectSearchInput("");
    setDefectSearch("");
    setDefectStatusFilter("all");
    setDefectCategoryFilter("all");
    setDefectPage(1);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Hero header + metrics ────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[28px] border border-border/70 bg-linear-to-br from-card via-card to-primary/5 p-6 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge
              variant="outline"
              className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary"
            >
              {t("admin.conditions.eyebrow")}
            </Badge>
            <div className="space-y-2">
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
                {t("admin.conditions.title")}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
                {t("admin.conditions.subtitle")}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 shadow-xs backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-info/10 text-info ring-1 ring-inset ring-info/15">
                <Info className="size-4" />
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                {t("admin.conditions.bilingualNote")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <MetricCard
            icon={Layers3}
            label={t("admin.conditions.totalCategories")}
            value={categoryTotal}
            tone="primary"
          />
          <MetricCard
            icon={ShieldAlert}
            label={t("admin.conditions.totalDefects")}
            value={defectTotal}
            tone="warning"
          />
        </div>
      </section>

      {/* ── Categories section ────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/70 bg-muted/20 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                  <FolderTree className="size-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      {t("admin.conditions.categoriesTitle")}
                    </h2>
                    {!categoriesLoading && (
                      <Badge variant="outline" className="rounded-full bg-background px-2.5 py-1">
                        {categoryTotal}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {t("admin.conditions.categoriesDescription")}
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={openCreateCategory} className="gap-2 self-start">
              <Plus className="size-4" />
              {t("admin.conditions.addCategory")}
            </Button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_180px_auto]">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("admin.conditions.search")}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={categorySearchInput}
                  onChange={(e) => setCategorySearchInput(e.target.value)}
                  placeholder={t("admin.conditions.searchCategoriesPlaceholder")}
                  className="h-10 ps-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("admin.conditions.status")}</Label>
              <Select
                value={categoryStatusFilter}
                onValueChange={(v) => {
                  setCategoryStatusFilter(v as StatusFilter);
                  setCategoryPage(1);
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.conditions.filterAllStatuses")}</SelectItem>
                  <SelectItem value="true">{t("admin.conditions.active")}</SelectItem>
                  <SelectItem value="false">{t("admin.conditions.inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={clearCategoryFilters}
                className="h-10 gap-2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
                {t("admin.conditions.clearFilters")}
              </Button>
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/35 hover:bg-muted/35">
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.conditions.name")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.conditions.status")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.conditions.lastUpdated")}
              </TableHead>
              <TableHead className="py-3 text-end text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.conditions.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {categoriesLoading ? (
              Array.from({ length: categoryPageSize }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="py-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="py-4">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : categoriesEmpty ? (
              <TableRow>
                <TableCell colSpan={4} className="py-20 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted/50 text-muted-foreground/45 ring-1 ring-border/50">
                      <FolderTree className="size-7" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("admin.conditions.emptyCategories")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow
                  key={category.id}
                  className="border-border/50 hover:bg-muted/20"
                >
                  <TableCell className="py-4">
                    <p
                      className="font-medium text-foreground"
                      dir={isArabic ? "rtl" : "ltr"}
                      style={isArabic ? arabicFontStyle : undefined}
                    >
                      {getLocalizedCategoryName(category)}
                    </p>
                  </TableCell>
                  <TableCell className="py-4">
                    <StatusBadge
                      active={category.isActive}
                      activeLabel={t("admin.conditions.active")}
                      inactiveLabel={t("admin.conditions.inactive")}
                    />
                  </TableCell>
                  <TableCell className="py-4 text-sm text-muted-foreground">
                    {formatDate(getUpdatedAt(category.updatedAt, category.createdAt))}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEditCategory(category)}
                        className="rounded-lg"
                        title={t("admin.conditions.edit")}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleCategoryActive(category)}
                        className="rounded-lg"
                        title={
                          category.isActive
                            ? t("admin.conditions.deactivate")
                            : t("admin.conditions.activate")
                        }
                      >
                        {category.isActive ? (
                          <PowerOff className="size-4 text-warning" />
                        ) : (
                          <Power className="size-4 text-success" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setCategoryDeleteTarget(category)}
                        className="rounded-lg text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                        title={t("admin.conditions.delete")}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <PaginationBar
          page={categoryPage}
          totalPages={categoryTotalPages}
          onPageChange={setCategoryPage}
          pageSize={categoryPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(size) => { setCategoryPage(1); setCategoryPageSize(size); }}
          totalItems={categoryTotal}
          rowsPerPageLabel={t("admin.common.rowsPerPage")}
          dir="ltr"
        />
      </section>

      {/* ── Defects section ───────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/70 bg-muted/20 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/10 text-warning ring-1 ring-inset ring-warning/15">
                  <ShieldAlert className="size-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      {t("admin.conditions.defectsTitle")}
                    </h2>
                    {!defectsLoading && (
                      <Badge variant="outline" className="rounded-full bg-background px-2.5 py-1">
                        {defectTotal}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {t("admin.conditions.defectsDescription")}
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={openCreateDefect} className="gap-2 self-start">
              <Plus className="size-4" />
              {t("admin.conditions.addDefect")}
            </Button>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_190px_220px_auto]">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("admin.conditions.search")}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={defectSearchInput}
                  onChange={(e) => setDefectSearchInput(e.target.value)}
                  placeholder={t("admin.conditions.searchDefectsPlaceholder")}
                  className="h-10 ps-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("admin.conditions.status")}</Label>
              <Select
                value={defectStatusFilter}
                onValueChange={(v) => {
                  setDefectStatusFilter(v as StatusFilter);
                  setDefectPage(1);
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.conditions.filterAllStatuses")}</SelectItem>
                  <SelectItem value="true">{t("admin.conditions.active")}</SelectItem>
                  <SelectItem value="false">{t("admin.conditions.inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("admin.conditions.category")}</Label>
              <Select
                value={defectCategoryFilter}
                onValueChange={(v) => { setDefectCategoryFilter(v); setDefectPage(1); }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.conditions.filterAllCategories")}</SelectItem>
                  {categoriesForSelect.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {getLocalizedCategoryName(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={clearDefectFilters}
                className="h-10 gap-2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
                {t("admin.conditions.clearFilters")}
              </Button>
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/35 hover:bg-muted/35">
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.conditions.defect")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.conditions.category")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.conditions.description")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.conditions.status")}
              </TableHead>
              <TableHead className="py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.conditions.lastUpdated")}
              </TableHead>
              <TableHead className="py-3 text-end text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("admin.conditions.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {defectsLoading ? (
              Array.from({ length: defectPageSize > 5 ? 5 : defectPageSize }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="py-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <Skeleton className="h-6 w-28 rounded-full" />
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="py-4">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : defectsEmpty ? (
              <TableRow>
                <TableCell colSpan={6} className="py-20 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted/50 text-muted-foreground/45 ring-1 ring-border/50">
                      <ShieldAlert className="size-7" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("admin.conditions.emptyDefects")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              defects.map((defect) => (
                <TableRow key={defect.id} className="border-border/50 hover:bg-muted/20">
                  <TableCell className="py-4">
                    <p
                      className="font-medium text-foreground"
                      dir={isArabic ? "rtl" : "ltr"}
                      style={isArabic ? arabicFontStyle : undefined}
                    >
                      {getLocalizedDefectName(defect)}
                    </p>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge variant="outline" className="max-w-full rounded-full px-2.5 py-1">
                      <span
                        className="truncate"
                        dir={isArabic ? "rtl" : "ltr"}
                        style={isArabic ? arabicFontStyle : undefined}
                      >
                        {getLocalizedDefectCategoryName(defect)}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4">
                    <p
                      className="line-clamp-2 max-w-md text-sm text-muted-foreground"
                      dir={isArabic ? "rtl" : "ltr"}
                      style={isArabic ? arabicFontStyle : undefined}
                    >
                      {getLocalizedDefectDescription(defect) || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="py-4">
                    <StatusBadge
                      active={defect.isActive}
                      activeLabel={t("admin.conditions.active")}
                      inactiveLabel={t("admin.conditions.inactive")}
                    />
                  </TableCell>
                  <TableCell className="py-4 text-sm text-muted-foreground">
                    {formatDate(getUpdatedAt(defect.updatedAt, defect.createdAt))}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEditDefect(defect)}
                        className="rounded-lg"
                        title={t("admin.conditions.edit")}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleDefectActive(defect)}
                        className="rounded-lg"
                        title={
                          defect.isActive
                            ? t("admin.conditions.deactivate")
                            : t("admin.conditions.activate")
                        }
                      >
                        {defect.isActive ? (
                          <PowerOff className="size-4 text-warning" />
                        ) : (
                          <Power className="size-4 text-success" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDefectDeleteTarget(defect)}
                        className="rounded-lg text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                        title={t("admin.conditions.delete")}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <PaginationBar
          page={defectPage}
          totalPages={defectTotalPages}
          onPageChange={setDefectPage}
          pageSize={defectPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(size) => { setDefectPage(1); setDefectPageSize(size); }}
          totalItems={defectTotal}
          rowsPerPageLabel={t("admin.common.rowsPerPage")}
          dir="ltr"
        />
      </section>

      {/* ── Category create/edit dialog ───────────────────────────────── */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingCategory
                ? t("admin.conditions.editCategoryTitle")
                : t("admin.conditions.createCategoryTitle")}
            </DialogTitle>
            <DialogDescription className="leading-7">
              {editingCategory
                ? t("admin.conditions.editCategoryDescription")
                : t("admin.conditions.createCategoryDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
                {t("admin.conditions.bilingualFields")}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="category-name">
                  {t("admin.conditions.name")} ({t("admin.conditions.enLabel")}){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="category-name"
                  value={categoryForm.name}
                  onChange={handleCategoryFieldChange("name")}
                  placeholder={t("admin.conditions.categoryPlaceholder")}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-name-ar">
                  {t("admin.conditions.nameAr")} ({t("admin.conditions.arLabel")}){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="category-name-ar"
                  value={categoryForm.nameAr}
                  onChange={handleCategoryFieldChange("nameAr")}
                  placeholder={t("admin.conditions.categoryPlaceholderAr")}
                  maxLength={100}
                  dir="rtl"
                  style={arabicFontStyle}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCategoryDialogOpen(false)}
              disabled={isCategorySaving}
            >
              {t("buttons.cancel")}
            </Button>
            <Button onClick={handleSaveCategory} disabled={isCategorySaving} className="gap-2">
              {isCategorySaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("admin.conditions.saving")}
                </>
              ) : (
                t("buttons.save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Defect create/edit dialog ─────────────────────────────────── */}
      <Dialog open={defectDialogOpen} onOpenChange={setDefectDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingDefect
                ? t("admin.conditions.editDefectTitle")
                : t("admin.conditions.createDefectTitle")}
            </DialogTitle>
            <DialogDescription className="leading-7">
              {editingDefect
                ? t("admin.conditions.editDefectDescription")
                : t("admin.conditions.createDefectDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-1.5">
                <Label>
                  {t("admin.conditions.category")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Combobox
                  value={defectForm.categoryId}
                  onValueChange={(value) =>
                    setDefectForm((prev) => ({ ...prev, categoryId: value }))
                  }
                  options={categoryOptions}
                  placeholder={t("admin.conditions.selectCategory")}
                  searchPlaceholder={t("admin.conditions.searchCategory")}
                  emptyText={t("admin.conditions.noCategoryFound")}
                  aria-invalid={!defectForm.categoryId}
                />
              </div>
              <div className="rounded-2xl border border-info/20 bg-info/8 px-4 py-3">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 size-4 shrink-0 text-info" />
                  <p className="text-sm leading-6 text-info/90">
                    {t("admin.conditions.defectHint")}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
                {t("admin.conditions.bilingualFields")}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="defect-name">
                  {t("admin.conditions.defect")} ({t("admin.conditions.enLabel")}){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="defect-name"
                  value={defectForm.itemName}
                  onChange={handleDefectInputChange("itemName")}
                  placeholder={t("admin.conditions.defectPlaceholder")}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="defect-name-ar">
                  {t("admin.conditions.defect")} ({t("admin.conditions.arLabel")}){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="defect-name-ar"
                  value={defectForm.itemNameAr}
                  onChange={handleDefectInputChange("itemNameAr")}
                  placeholder={t("admin.conditions.defectPlaceholderAr")}
                  maxLength={200}
                  dir="rtl"
                  style={arabicFontStyle}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="defect-description">
                  {t("admin.conditions.description")} ({t("admin.conditions.enLabel")})
                </Label>
                <Textarea
                  id="defect-description"
                  value={defectForm.description}
                  onChange={handleDefectInputChange("description")}
                  placeholder={t("admin.conditions.descriptionPlaceholder")}
                  maxLength={500}
                  className="min-h-28"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="defect-description-ar">
                  {t("admin.conditions.descriptionAr")} ({t("admin.conditions.arLabel")})
                </Label>
                <Textarea
                  id="defect-description-ar"
                  value={defectForm.descriptionAr}
                  onChange={handleDefectInputChange("descriptionAr")}
                  placeholder={t("admin.conditions.descriptionPlaceholderAr")}
                  maxLength={500}
                  className="min-h-28 leading-8"
                  dir="rtl"
                  style={arabicFontStyle}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDefectDialogOpen(false)}
              disabled={isDefectSaving}
            >
              {t("buttons.cancel")}
            </Button>
            <Button onClick={handleSaveDefect} disabled={isDefectSaving} className="gap-2">
              {isDefectSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("admin.conditions.saving")}
                </>
              ) : (
                t("buttons.save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Category delete dialog ────────────────────────────────────── */}
      <Dialog
        open={!!categoryDeleteTarget}
        onOpenChange={(open) => { if (!open) setCategoryDeleteTarget(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20">
              <Trash2 className="size-5" />
            </div>
            <div>
              <DialogTitle>{t("admin.conditions.deleteCategoryTitle")}</DialogTitle>
              <DialogDescription className="mt-2 leading-7">
                {t("admin.conditions.deleteCategoryDescription", {
                  name: categoryDeleteTarget?.name ?? "",
                })}
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="rounded-2xl border border-warning/25 bg-warning/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-sm leading-6 text-warning/95">
                {t("admin.conditions.deleteCategoryDependencyHint")}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCategoryDeleteTarget(null)}
              disabled={isCategoryDeleting}
            >
              {t("buttons.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCategory}
              disabled={isCategoryDeleting}
              className="gap-2"
            >
              {isCategoryDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("admin.conditions.deleting")}
                </>
              ) : (
                t("buttons.delete")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Defect delete dialog ──────────────────────────────────────── */}
      <Dialog
        open={!!defectDeleteTarget}
        onOpenChange={(open) => { if (!open) setDefectDeleteTarget(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20">
              <Trash2 className="size-5" />
            </div>
            <div>
              <DialogTitle>{t("admin.conditions.deleteDefectTitle")}</DialogTitle>
              <DialogDescription className="mt-2 leading-7">
                {t("admin.conditions.deleteDefectDescription", {
                  name: defectDeleteTarget?.itemName ?? "",
                })}
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDefectDeleteTarget(null)}
              disabled={isDefectDeleting}
            >
              {t("buttons.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDefect}
              disabled={isDefectDeleting}
              className="gap-2"
            >
              {isDefectDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("admin.conditions.deleting")}
                </>
              ) : (
                t("buttons.delete")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Conditions;
