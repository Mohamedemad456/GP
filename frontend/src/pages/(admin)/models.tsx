import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Loader2,
  Info,
  Plus,
  Search,
  SlidersHorizontal,
  ChevronDown,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Boxes,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Input,
  Label,
  Skeleton,
  PaginationBar,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Combobox,
} from "@gp/design-system";
import { useToast } from "@/hooks/use-toast";
import {
  getAllModels,
  createModel,
  updateModel,
  activateModel,
  deactivateModel,
  deleteModel,
  type ModelDto,
  type CreateModelRequest,
  type ModelSpecParams,
} from "@/lib/modelsApi";
import { getAllMakes, type MakeDto } from "@/lib/makesApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = { name: string; nameAr: string; makeId: string };
const EMPTY_FORM: FormState = { name: "", nameAr: "", makeId: "" };

type SortField = "name" | "createdAt";
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

// ─── Component ────────────────────────────────────────────────────────────────

const Models = () => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith("ar");
  const { success, error } = useToast();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [models, setModels] = useState<ModelDto[]>([]);
  const [makes, setMakes] = useState<MakeDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // ── Server-side pagination ──────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── Filters ───────────────────────────────────────────────────────────
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<"" | "true" | "false">("");
  const [makeFilter, setMakeFilter] = useState("");

  // ── Sorting ────────────────────────────────────────────────────────────
  const [sort, setSort] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ── Dialogs ────────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelDto | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ModelDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const activeFilterCount = [search, isActiveFilter, makeFilter].filter(Boolean).length;

  // ── Search debounce ────────────────────────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]);

  // ── Sort handler ───────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sort === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const sortIcon = (field: SortField) => {
    if (sort !== field) return <ArrowUpDown className="size-3 opacity-25" />;
    return sortDir === "asc"
      ? <ArrowUp className="size-3 text-primary" />
      : <ArrowDown className="size-3 text-primary" />;
  };

  // ── Fetch makes for filters/form ───────────────────────────────────────
  const fetchMakes = useCallback(async () => {
    try {
      const all: MakeDto[] = [];
      let pageIndex = 1;
      let total = 0;
      do {
        const res = await getAllMakes({ pageIndex, pageSize: 10 });
        if (!res.success) break;
        all.push(...(res.data?.data ?? []));
        total = res.data?.count ?? 0;
        pageIndex++;
      } while (all.length < total);
      setMakes(all);
    } catch {
      // non-critical; combobox will be empty
    }
  }, []);

  // ── Fetch models (server-side) ─────────────────────────────────────────
  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: ModelSpecParams = {
        pageIndex: page,
        pageSize,
        sort,
        sortDirection: sortDir,
        ...(search ? { search } : {}),
        ...(isActiveFilter !== "" ? { isActive: isActiveFilter === "true" } : {}),
        ...(makeFilter ? { makeId: makeFilter } : {}),
      };
      const res = await getAllModels(params);
      if (res.success && res.data) {
        setModels(res.data.data);
        setTotalCount(res.data.count);
      }
    } catch {
      error(t("admin.models.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sort, sortDir, search, isActiveFilter, makeFilter, error, t]);

  useEffect(() => { void fetchModels(); }, [fetchModels]);
  useEffect(() => { void fetchMakes(); }, [fetchMakes]);

  // Guard: reset page when total shrinks
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // ── Filter helpers ─────────────────────────────────────────────────────
  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setIsActiveFilter("");
    setMakeFilter("");
    setPage(1);
  };

  // ── Dialog handlers ────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingModel(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (model: ModelDto) => {
    setEditingModel(model);
    setFormData({
      name: isArabic ? "" : model.name,
      nameAr: isArabic ? model.name : "",
      makeId: model.makeId,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.nameAr.trim()) {
      error(t("admin.models.nameRequired"));
      return;
    }
    if (!formData.makeId) {
      error(t("admin.models.makeRequired"));
      return;
    }
    setIsSaving(true);
    try {
      const payload: CreateModelRequest = {
        name: formData.name.trim(),
        nameAr: formData.nameAr.trim(),
        makeId: formData.makeId,
      };
      if (editingModel) {
        const res = await updateModel(editingModel.id, payload);
        if (res.success) {
          success(t("admin.models.updateSuccess"));
          await fetchModels();
          setDialogOpen(false);
        } else {
          error(t("admin.models.updateError"), { description: res.message });
        }
      } else {
        const res = await createModel(payload);
        if (res.success) {
          success(t("admin.models.createSuccess"));
          setPage(1);
          await fetchModels();
          setDialogOpen(false);
        } else {
          error(t("admin.models.createError"), { description: res.message });
        }
      }
    } catch {
      error(editingModel ? t("admin.models.updateError") : t("admin.models.createError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (model: ModelDto) => {
    try {
      const res = model.isActive
        ? await deactivateModel(model.id)
        : await activateModel(model.id);
      if (res.success) {
        success(model.isActive ? t("admin.models.deactivated") : t("admin.models.activated"));
        await fetchModels();
      } else {
        error(t("admin.models.toggleError"), { description: res.message });
      }
    } catch {
      error(t("admin.models.toggleError"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteModel(deleteTarget.id);
      if (res.success) {
        success(t("admin.models.deleteSuccess"));
        setDeleteTarget(null);
        await fetchModels();
      } else {
        error(t("admin.models.deleteError"), { description: res.message });
      }
    } catch {
      error(t("admin.models.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFieldChange =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {t("admin.models.title")}
            </h1>
            {!isLoading && totalCount > 0 && (
              <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold tabular-nums text-primary">
                {totalCount}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.models.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setFiltersOpen((o) => !o)}
            className="relative gap-2"
          >
            <SlidersHorizontal className="size-4" />
            {t("admin.models.filtersBtn", "Filters")}
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -end-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold leading-none text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              className={`size-3.5 opacity-50 transition-all duration-200 ${filtersOpen ? "rotate-180" : ""}`}
            />
          </Button>

          <Button onClick={openCreate} className="gap-2 shadow-xs">
            <Plus className="size-4" />
            {t("admin.models.addModel")}
          </Button>
        </div>
      </div>

      {/* ── Filters panel ─────────────────────────────────────────────── */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          filtersOpen ? "max-h-56 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div
          className="rounded-xl border border-border/70 bg-card px-5 py-4 shadow-xs"
          style={{
            borderInlineStartWidth: "3px",
            borderInlineStartColor:
              "color-mix(in oklch, var(--primary) 40%, transparent)",
          }}
        >
          <div className="flex flex-wrap items-end gap-4">
            {/* Search */}
            <div className="min-w-52 flex-1 space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {t("admin.models.searchLabel", "Search")}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  className="h-9 ps-8 text-sm"
                  placeholder={t("admin.models.searchPlaceholder", "Search by name…")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>

            {/* Make filter */}
            <div className="min-w-40 space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {t("admin.models.make")}
              </label>
              <Select
                value={makeFilter === "" ? "all" : makeFilter}
                onValueChange={(v) => {
                  setMakeFilter(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder={t("admin.models.allMakes", "All makes")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.models.allMakes", "All makes")}</SelectItem>
                  {makes.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {t("admin.models.status")}
              </label>
              <Select
                value={isActiveFilter === "" ? "all" : isActiveFilter}
                onValueChange={(v) => {
                  setIsActiveFilter(v === "all" ? "" : (v as "true" | "false"));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.models.filterAll", "All")}</SelectItem>
                  <SelectItem value="true">{t("admin.models.active")}</SelectItem>
                  <SelectItem value="false">{t("admin.models.inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
                {t("admin.models.clearFilters", "Clear")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Models table ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/70 bg-muted/40 hover:bg-muted/40">
              <TableHead
                className="cursor-pointer select-none py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 hover:text-foreground"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1.5">
                  {t("admin.models.name")}
                  {sortIcon("name")}
                </div>
              </TableHead>
              <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                {t("admin.models.make")}
              </TableHead>
              <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                {t("admin.models.status")}
              </TableHead>
              <TableHead className="py-3 text-end text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                {t("admin.models.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize > 5 ? 5 : pageSize }).map((_, i) => (
                <TableRow key={i} className="border-border/40">
                  <TableCell className="py-3">
                    <Skeleton className="h-3.5 w-28" />
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="h-3.5 w-20" />
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex justify-end gap-1">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : models.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-20 text-center">
                  <div className="mx-auto flex max-w-[240px] flex-col items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border/50">
                      <Boxes className="size-7 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("admin.models.empty")}
                    </p>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearFilters}
                        className="text-xs text-primary hover:underline"
                      >
                        {t("admin.models.clearFilters", "Clear filters")}
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              models.map((model) => (
                <TableRow
                  key={model.id}
                  className="border-border/40 transition-colors hover:bg-muted/25"
                >
                  <TableCell className="py-3 font-medium text-foreground">
                    {model.name}
                  </TableCell>

                  <TableCell className="py-3 text-sm text-muted-foreground">
                    {model.makeName}
                  </TableCell>

                  <TableCell className="py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        model.isActive
                          ? "bg-success/10 text-success ring-success/25"
                          : "bg-muted/50 text-muted-foreground ring-border/60"
                      }`}
                    >
                      {model.isActive ? t("admin.models.active") : t("admin.models.inactive")}
                    </span>
                  </TableCell>

                  <TableCell className="py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(model)}
                        title={t("admin.models.edit")}
                        className="rounded-lg"
                      >
                        <Pencil className="size-[15px]" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleActive(model)}
                        title={model.isActive ? t("admin.models.deactivateBtn") : t("admin.models.activateBtn")}
                        className="rounded-lg"
                      >
                        {model.isActive ? (
                          <PowerOff className="size-[15px] text-warning" />
                        ) : (
                          <Power className="size-[15px] text-success" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(model)}
                        title={t("admin.models.delete")}
                        className="rounded-lg text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-[15px]" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <PaginationBar
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
          totalItems={totalCount}
          rowsPerPageLabel={t("admin.common.rowsPerPage")}
          dir="ltr"
        />
      </div>

      {/* ── Create / Edit Dialog ──────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingModel ? t("admin.models.editTitle") : t("admin.models.createTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {editingModel ? t("admin.models.editDescription") : t("admin.models.createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* EN / AR divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                EN / AR
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {editingModel ? (
              // Edit: show only the language-specific name field
              isArabic ? (
                <div className="space-y-1.5">
                  <Label htmlFor="model-nameAr" className="text-xs font-medium">
                    {t("admin.models.nameAr")}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">(AR)</span>{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="model-nameAr"
                    value={formData.nameAr}
                    dir="rtl"
                    onChange={handleFieldChange("nameAr")}
                    placeholder="كامري"
                    className="h-9 text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="model-name" className="text-xs font-medium">
                    {t("admin.models.name")}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">(EN)</span>{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="model-name"
                    value={formData.name}
                    onChange={handleFieldChange("name")}
                    placeholder="Camry"
                    className="h-9 text-sm"
                  />
                </div>
              )
            ) : (
              // Create: both name fields
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="model-name" className="text-xs font-medium">
                    {t("admin.models.name")}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">(EN)</span>{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="model-name"
                    value={formData.name}
                    onChange={handleFieldChange("name")}
                    placeholder="Camry"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="model-nameAr" className="text-xs font-medium">
                    {t("admin.models.nameAr")}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">(AR)</span>{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="model-nameAr"
                    value={formData.nameAr}
                    dir="rtl"
                    onChange={handleFieldChange("nameAr")}
                    placeholder="كامري"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Make selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t("admin.models.make")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Combobox
                value={formData.makeId}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, makeId: v }))}
                options={makes.filter((m) => m.isActive).map((m) => ({ value: m.id, label: m.name }))}
                placeholder={t("admin.models.selectMake")}
                searchPlaceholder={t("admin.models.searchMake")}
                emptyText={t("admin.models.noMakeFound")}
              />
            </div>

            {editingModel && (
              <div className="flex items-start gap-2.5 rounded-lg border border-info/20 bg-info/8 px-3 py-2.5">
                <Info className="mt-0.5 size-3.5 shrink-0 text-info" />
                <span className="text-xs leading-relaxed text-info/90">
                  {t("admin.models.langHint")}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
              className="min-w-[80px]"
            >
              {t("buttons.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="min-w-[96px] gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {t("admin.models.saving")}
                </>
              ) : (
                t("buttons.save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ────────────────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="flex-row items-start gap-4 space-y-0 pb-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-inset ring-destructive/20">
              <Trash2 className="size-5 text-destructive" />
            </div>
            <div className="flex-1 pt-0.5">
              <DialogTitle className="text-base leading-snug">
                {t("admin.models.deleteTitle")}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-sm leading-relaxed">
                {t("admin.models.deleteDescription", { name: deleteTarget?.name ?? "" })}
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="flex-1 sm:flex-none"
            >
              {t("buttons.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 gap-2 sm:flex-none"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {t("admin.models.deleting")}
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

export default Models;
