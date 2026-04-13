import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  ImageIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
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
} from "@/lib/makesApi";

type FormState = {
  name: string;
  nameAr: string;
  country: string;
  countryAr: string;
};

const EMPTY_FORM: FormState = { name: "", nameAr: "", country: "", countryAr: "" };

const Makes = () => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const { success, error } = useToast();

  const [makes, setMakes] = useState<MakeDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalItems = makes.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalItems, page * pageSize);

  const pageMakes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return makes.slice(start, start + pageSize);
  }, [makes, page, pageSize]);

  const visiblePages = useMemo(() => {
    if (totalPages <= 3) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    pages.add(page);
    return Array.from(pages).sort((a, b) => a - b);
  }, [page, totalPages]);

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

  const fetchMakes = useCallback(async (resetPage = false) => {
    setIsLoading(true);
    try {
      const res = await getAllMakes();
      if (res.success) {
        setMakes(res.data ?? []);
        if (resetPage) setPage(1);
      }
    } catch {
      error(t("admin.makes.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [error, t]);

  useEffect(() => {
    fetchMakes();
  }, [fetchMakes]);

  // Guard: if current page is now beyond totalPages (e.g. after delete), go back
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openCreate = () => {
    setEditingMake(null);
    setFormData(EMPTY_FORM);
    setIconFile(null);
    setIconPreview("");
    setDialogOpen(true);
  };

  const openEdit = (make: MakeDto) => {
    setEditingMake(make);
    setFormData({
      name: make.name,
      nameAr: make.nameAr,
      country: make.country ?? "",
      countryAr: make.countryAr ?? "",
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
          await fetchMakes(true);
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
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {t("admin.makes.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.makes.subtitle")}</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          {t("admin.makes.addMake")}
        </Button>
      </div>

      {/* Makes table */}
      <div className="rounded-2xl border border-border/80 bg-card/95 shadow-elevated overflow-hidden">
        <Table>
          <TableCaption className="px-4 pb-3 pt-2 text-xs text-muted-foreground">
            {t("admin.makes.caption", { count: totalItems })}
          </TableCaption>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-20 text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.makes.logo")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.makes.name")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.makes.country")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.makes.status")}
              </TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.makes.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-14 w-14 rounded-lg" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 ms-auto" /></TableCell>
                </TableRow>
              ))
            ) : pageMakes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  {t("admin.makes.empty")}
                </TableCell>
              </TableRow>
            ) : (
              pageMakes.map((make) => (
                <TableRow
                  key={make.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <TableCell>
                    {make.logoUrl ? (
                      <div className="h-14 w-14 flex items-center justify-center rounded-lg bg-muted/50 border border-border/50 p-1.5">
                        <img
                          src={getMakeLogoUrl(make.logoUrl)}
                          alt={make.name}
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            (e.currentTarget.parentElement as HTMLElement).innerHTML =
                              `<svg xmlns="http://www.w3.org/2000/svg" class="size-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-14 w-14 flex items-center justify-center rounded-lg bg-muted/50 border border-border/50 text-muted-foreground">
                        <ImageIcon className="size-6" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {make.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {make.country ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={make.isActive ? "default" : "secondary"}>
                      {make.isActive ? t("admin.makes.active") : t("admin.makes.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(make)}
                        className="h-8 w-8 p-0"
                        title={t("admin.makes.edit")}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(make)}
                        className="h-8 w-8 p-0"
                        title={make.isActive ? t("admin.makes.deactivateBtn") : t("admin.makes.activateBtn")}
                      >
                        {make.isActive ? (
                          <PowerOff className="size-4 text-amber-500" />
                        ) : (
                          <Power className="size-4 text-emerald-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(make)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title={t("admin.makes.delete")}
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

        {/* Pagination footer */}
        <div className="border-t border-border px-4 py-3">
          <div className="flex flex-col gap-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
            <Pagination className="mx-auto w-auto justify-center md:mx-0 md:justify-start" dir="ltr">
              <PaginationContent className="flex-wrap">
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    size="default"
                    aria-label="Previous page"
                    className={page === 1 ? "pointer-events-none opacity-50" : ""}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                  >
                    <ChevronLeft className="size-4" />
                  </PaginationLink>
                </PaginationItem>

                {visiblePages.map((pageNumber, index) => {
                  const previousPage = visiblePages[index - 1];
                  const items = [];

                  if (index > 0 && previousPage !== undefined && pageNumber - previousPage > 1) {
                    items.push(
                      <PaginationItem key={`ellipsis-${previousPage}-${pageNumber}`}>
                        <PaginationEllipsis />
                      </PaginationItem>,
                    );
                  }

                  items.push(
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href="#"
                        isActive={pageNumber === page}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(pageNumber);
                        }}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>,
                  );

                  return items;
                })}

                <PaginationItem>
                  <PaginationLink
                    href="#"
                    size="default"
                    aria-label="Next page"
                    className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(totalPages, p + 1));
                    }}
                  >
                    <ChevronRight className="size-4" />
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>

            <div className="flex items-center gap-3">
              <span className="text-[11px]">
                {t("admin.common.rowsPerPage")}
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPage(1);
                  setPageSize(Number(e.target.value));
                }}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-muted-foreground/90">
                {from}–{to} / {totalItems}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={editingMake ? "sm:max-w-md" : "sm:max-w-lg"}>
          <DialogHeader>
            <DialogTitle>
              {editingMake ? t("admin.makes.editTitle") : t("admin.makes.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingMake
                ? t("admin.makes.editDescription")
                : t("admin.makes.createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-24 w-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title={t("admin.makes.uploadLogo")}
              >
                {iconPreview ? (
                  <img
                    src={iconPreview}
                    alt="Logo preview"
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <ImageIcon className="size-8 text-muted-foreground" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleIconChange}
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                {t("admin.makes.uploadLogo")}
              </Button>
            </div>

            <div className="space-y-4">
              {editingMake ? (
                // Edit: show only the active language's fields
                isArabic ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="make-nameAr">
                        {t("admin.makes.nameAr")} (AR){" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="make-nameAr"
                        value={formData.nameAr}
                        dir="rtl"
                        onChange={handleFieldChange("nameAr")}
                        placeholder="تويوتا"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="make-countryAr">
                        {t("admin.makes.countryAr")} (AR){" "}
                        <span className="text-xs text-muted-foreground">(مثال: اليابان)</span>
                      </Label>
                      <Input
                        id="make-countryAr"
                        value={formData.countryAr}
                        dir="rtl"
                        onChange={handleFieldChange("countryAr")}
                        placeholder="اليابان"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="make-name">
                        {t("admin.makes.name")} (EN){" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="make-name"
                        value={formData.name}
                        onChange={handleFieldChange("name")}
                        placeholder="Toyota"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="make-country">
                        {t("admin.makes.country")} (EN){" "}
                        <span className="text-xs text-muted-foreground">(e.g. Japan)</span>
                      </Label>
                      <Input
                        id="make-country"
                        value={formData.country}
                        onChange={handleFieldChange("country")}
                        placeholder="Japan"
                      />
                    </div>
                  </>
                )
              ) : (
                // Create: show all 4 fields in a 2-column grid (EN | AR)
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="make-name">
                      {t("admin.makes.name")} (EN){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="make-name"
                      value={formData.name}
                      onChange={handleFieldChange("name")}
                      placeholder="Toyota"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="make-nameAr">
                      {t("admin.makes.nameAr")} (AR){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="make-nameAr"
                      value={formData.nameAr}
                      dir="rtl"
                      onChange={handleFieldChange("nameAr")}
                      placeholder="تويوتا"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="make-country">
                      {t("admin.makes.country")} (EN){" "}
                      <span className="text-xs text-muted-foreground">(e.g. Japan)</span>
                    </Label>
                    <Input
                      id="make-country"
                      value={formData.country}
                      onChange={handleFieldChange("country")}
                      placeholder="Japan"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="make-countryAr">
                      {t("admin.makes.countryAr")} (AR){" "}
                      <span className="text-xs text-muted-foreground">(مثال: اليابان)</span>
                    </Label>
                    <Input
                      id="make-countryAr"
                      value={formData.countryAr}
                      dir="rtl"
                      onChange={handleFieldChange("countryAr")}
                      placeholder="اليابان"
                    />
                  </div>
                </div>
              )}

              {editingMake && (
                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
                  <span>{t("admin.makes.langHint")}</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              {t("buttons.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <><Loader2 className="size-4 animate-spin" />{t("admin.makes.saving")}</>
              ) : (
                t("buttons.save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("admin.makes.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.makes.deleteDescription", { name: deleteTarget?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              {t("buttons.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <><Loader2 className="size-4 animate-spin" />{t("admin.makes.deleting")}</>
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
