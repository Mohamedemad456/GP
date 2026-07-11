import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  ImageIcon,
  Loader2,
  Info,
  SlidersHorizontal,
  ChevronDown,
  X,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
} from "@gp/design-system";
import { useToast } from "@/hooks/use-toast";
import {
  getAllMakes,
  createMake,
  updateMake,
  activateMake,
  deactivateMake,
  deleteMake,
  getMakeLogoUrl,
  type MakeDto,
  type CreateMakeRequest,
  type MakeSpecParams,
} from "@/lib/makesApi";

type FormState = {
  name: string;
  nameAr: string;
  country: string;
  countryAr: string;
};

const EMPTY_FORM: FormState = { name: "", nameAr: "", country: "", countryAr: "" };

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

type SortField = "name" | "country" | "createdAt";

const Makes = () => {
  const { t } = useTranslation();
  const { success, error } = useToast();

  // Data
  const [makes, setMakes] = useState<MakeDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Server-side pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<"" | "true" | "false">("");

  // Sorting — defaults match backend defaults
  const [sort, setSort] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Debounce search → reset to page 1 when it settles
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const activeFilterCount = [search, isActiveFilter].filter(Boolean).length;

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMake, setEditingMake] = useState<MakeDto | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<MakeDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const fetchMakes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: MakeSpecParams = {
        pageIndex: page,
        pageSize,
        sort,
        sortDirection: sortDir,
        ...(search ? { search } : {}),
        ...(isActiveFilter !== "" ? { isActive: isActiveFilter === "true" } : {}),
      };
      const res = await getAllMakes(params);
      if (res.success && res.data) {
        setMakes(res.data.data);
        setTotalCount(res.data.count);
      }
    } catch {
      error(t("admin.makes.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sort, sortDir, search, isActiveFilter, error, t]);

  useEffect(() => {
    fetchMakes();
  }, [fetchMakes]);

  // Guard: reset to last valid page when total shrinks (e.g. after delete)
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setIsActiveFilter("");
    setPage(1);
  };

  const openCreate = () => {
    setEditingMake(null);
    setFormData(EMPTY_FORM);
    setIconFile(null);
    setIconPreview("");
    setDialogOpen(true);
  };

  const openEdit = (make: MakeDto) => {
    setEditingMake(make);
    // nameAr / countryAr are not returned by the API — user must re-enter them
    setFormData({
      name: make.name,
      nameAr: "",
      country: make.country ?? "",
      countryAr: "",
    });
    setIconFile(null);
    setIconPreview(getMakeLogoUrl(make.logoUrl));
    setDialogOpen(true);
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.nameAr.trim()) {
      error(t("admin.makes.nameRequired"));
      return;
    }
    setIsSaving(true);
    try {
      const payload: CreateMakeRequest = {
        name: formData.name.trim(),
        nameAr: formData.nameAr.trim(),
        country: formData.country.trim() || undefined,
        countryAr: formData.countryAr.trim() || undefined,
        icon: iconFile ?? undefined,
      };
      if (editingMake) {
        const res = await updateMake(editingMake.id, payload);
        if (res.success) {
          success(t("admin.makes.updateSuccess"));
          await fetchMakes();
          setDialogOpen(false);
        } else {
          error(t("admin.makes.updateError"), { description: res.message });
        }
      } else {
        const res = await createMake(payload);
        if (res.success) {
          success(t("admin.makes.createSuccess"));
          setPage(1);
          await fetchMakes();
          setDialogOpen(false);
        } else {
          error(t("admin.makes.createError"), { description: res.message });
        }
      }
    } catch {
      error(editingMake ? t("admin.makes.updateError") : t("admin.makes.createError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (make: MakeDto) => {
    try {
      const res = make.isActive
        ? await deactivateMake(make.id)
        : await activateMake(make.id);
      if (res.success) {
        success(make.isActive ? t("admin.makes.deactivated") : t("admin.makes.activated"));
        await fetchMakes();
      } else {
        error(t("admin.makes.toggleError"), { description: res.message });
      }
    } catch {
      error(t("admin.makes.toggleError"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteMake(deleteTarget.id);
      if (res.success) {
        success(t("admin.makes.deleteSuccess"));
        setDeleteTarget(null);
        await fetchMakes();
      } else {
        error(t("admin.makes.deleteError"), { description: res.message });
      }
    } catch {
      error(t("admin.makes.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFieldChange =
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {t("admin.makes.title")}
            </h1>
            {!isLoading && totalCount > 0 && (
              <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold tabular-nums text-primary">
                {totalCount}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.makes.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setFiltersOpen((o) => !o)}
            className="relative gap-2"
          >
            <SlidersHorizontal className="size-4" />
            {t("admin.makes.filtersBtn")}
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -end-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold leading-none text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              className={`size-3.5 opacity-50 transition-all duration-200 ${
                filtersOpen ? "rotate-180" : ""
              }`}
            />
          </Button>

          <Button onClick={openCreate} className="gap-2 shadow-xs">
            <Plus className="size-4" />
            {t("admin.makes.addMake")}
          </Button>
        </div>
      </div>

      {/* ── Filters panel ────────────────────────────────────── */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          filtersOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div
          className="rounded-xl border border-border/70 bg-card px-5 py-4 shadow-xs"
          style={{ borderInlineStartWidth: "3px", borderInlineStartColor: "color-mix(in oklch, var(--primary) 40%, transparent)" }}
        >
          <div className="flex flex-wrap items-end gap-4">
            {/* Search */}
            <div className="min-w-56 flex-1 space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {t("admin.makes.searchLabel")}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  className="h-9 ps-8 text-sm"
                  placeholder={t("admin.makes.searchPlaceholder")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {t("admin.makes.status")}
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
                  <SelectItem value="all">{t("admin.makes.filterAll")}</SelectItem>
                  <SelectItem value="true">{t("admin.makes.active")}</SelectItem>
                  <SelectItem value="false">{t("admin.makes.inactive")}</SelectItem>
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
                {t("admin.makes.clearFilters")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Makes table ──────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/70 bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[68px] py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                {t("admin.makes.logo")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 hover:text-foreground"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1.5">
                  {t("admin.makes.name")}
                  {sortIcon("name")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 hover:text-foreground"
                onClick={() => handleSort("country")}
              >
                <div className="flex items-center gap-1.5">
                  {t("admin.makes.country")}
                  {sortIcon("country")}
                </div>
              </TableHead>
              <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                {t("admin.makes.status")}
              </TableHead>
              <TableHead className="py-3 text-end text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                {t("admin.makes.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={i} className="border-border/40">
                  <TableCell className="py-3">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-14 opacity-50" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="h-3.5 w-16" />
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
            ) : makes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-20 text-center">
                  <div className="mx-auto flex max-w-[240px] flex-col items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border/50">
                      <ImageIcon className="size-7 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("admin.makes.empty")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              makes.map((make) => (
                <TableRow
                  key={make.id}
                  className="border-border/40 transition-colors hover:bg-muted/25"
                >
                  <TableCell className="py-3">
                    {make.logoUrl ? (
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-muted/30 p-1.5 transition-shadow hover:shadow-sm">
                        <img
                          src={getMakeLogoUrl(make.logoUrl)}
                          alt={make.name}
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            (e.currentTarget.parentElement as HTMLElement).innerHTML =
                              `<svg xmlns="http://www.w3.org/2000/svg" class="size-5 opacity-25" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 text-muted-foreground/25">
                        <ImageIcon className="size-5" />
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="py-3">
                    <span className="font-medium text-foreground">{make.name}</span>
                  </TableCell>

                  <TableCell className="py-3 text-sm text-muted-foreground">
                    {make.country ?? (
                      <span className="text-muted-foreground/35">—</span>
                    )}
                  </TableCell>

                  <TableCell className="py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        make.isActive
                          ? "bg-success/10 text-success ring-success/25"
                          : "bg-muted/50 text-muted-foreground ring-border/60"
                      }`}
                    >
                      {make.isActive ? t("admin.makes.active") : t("admin.makes.inactive")}
                    </span>
                  </TableCell>

                  <TableCell className="py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(make)}
                        title={t("admin.makes.edit")}
                        className="rounded-lg"
                      >
                        <Pencil className="size-[15px]" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleActive(make)}
                        title={make.isActive ? t("admin.makes.deactivateBtn") : t("admin.makes.activateBtn")}
                        className="rounded-lg"
                      >
                        {make.isActive ? (
                          <PowerOff className="size-[15px] text-warning" />
                        ) : (
                          <Power className="size-[15px] text-success" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(make)}
                        title={t("admin.makes.delete")}
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

      {/* ── Create / Edit Dialog ─────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingMake ? t("admin.makes.editTitle") : t("admin.makes.createTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {editingMake
                ? t("admin.makes.editDescription")
                : t("admin.makes.createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Logo row */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 transition-all duration-150 hover:border-primary/50 hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                title={t("admin.makes.uploadLogo")}
              >
                {iconPreview ? (
                  <>
                    <img
                      src={iconPreview}
                      alt="Logo preview"
                      className="h-full w-full object-contain p-2"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <ImageIcon className="size-5 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground transition-colors duration-150 group-hover:text-primary/70">
                    <ImageIcon className="size-5" />
                    <span className="text-center text-[9px] font-semibold uppercase leading-tight tracking-wide">
                      Upload
                    </span>
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleIconChange}
              />
              {iconPreview && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("admin.makes.changeLogo")}
                </button>
              )}
            </div>

            {/* EN / AR divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                EN / AR
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="make-name" className="text-xs font-medium">
                  {t("admin.makes.name")}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">(EN)</span>{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="make-name"
                  value={formData.name}
                  onChange={handleFieldChange("name")}
                  placeholder="Toyota"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="make-nameAr" className="text-xs font-medium">
                  {t("admin.makes.nameAr")}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">(AR)</span>{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="make-nameAr"
                  value={formData.nameAr}
                  dir="rtl"
                  onChange={handleFieldChange("nameAr")}
                  placeholder="تويوتا"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Country fields */}
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="make-country" className="text-xs font-medium">
                  {t("admin.makes.country")}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">(EN)</span>
                </Label>
                <Input
                  id="make-country"
                  value={formData.country}
                  onChange={handleFieldChange("country")}
                  placeholder="Japan"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="make-countryAr" className="text-xs font-medium">
                  {t("admin.makes.countryAr")}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">(AR)</span>
                </Label>
                <Input
                  id="make-countryAr"
                  value={formData.countryAr}
                  dir="rtl"
                  onChange={handleFieldChange("countryAr")}
                  placeholder="اليابان"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {editingMake && (
              <div className="flex items-start gap-2.5 rounded-lg border border-info/20 bg-info/8 px-3 py-2.5">
                <Info className="mt-0.5 size-3.5 shrink-0 text-info" />
                <span className="text-xs leading-relaxed text-info/90">
                  {t("admin.makes.editHint")}
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
                  {t("admin.makes.saving")}
                </>
              ) : (
                t("buttons.save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ───────────────────────── */}
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
                {t("admin.makes.deleteTitle")}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-sm leading-relaxed">
                {t("admin.makes.deleteDescription", { name: deleteTarget?.name })}
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
                  {t("admin.makes.deleting")}
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

export default Makes;
