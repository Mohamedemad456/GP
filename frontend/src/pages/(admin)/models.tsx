import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Loader2,
  Info,
  Plus,
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
  PaginationBar,
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
} from "@/lib/modelsApi";
import { getAllMakes, type MakeDto } from "@/lib/makesApi";

type FormState = {
  name: string;
  nameAr: string;
  makeId: string;
};

const EMPTY_FORM: FormState = { name: "", nameAr: "", makeId: "" };

const Models = () => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const { success, error } = useToast();

  const [models, setModels] = useState<ModelDto[]>([]);
  const [makes, setMakes] = useState<MakeDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalItems = models.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageModels = useMemo(() => {
    const start = (page - 1) * pageSize;
    return models.slice(start, start + pageSize);
  }, [models, page, pageSize]);

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelDto | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ModelDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchModels = useCallback(
    async (resetPage = false) => {
      setIsLoading(true);
      try {
        const res = await getAllModels();
        if (res.success) {
          setModels(res.data ?? []);
          if (resetPage) setPage(1);
        }
      } catch {
        error(t("admin.models.loadError"));
      } finally {
        setIsLoading(false);
      }
    },
    [error, t]
  );

  const fetchMakes = useCallback(async () => {
    try {
      const res = await getAllMakes({ pageSize: 10 });
      if (res.success) setMakes(res.data?.data ?? []);
    } catch {
      error(t("admin.models.loadMakesError"));
    }
  }, [error, t]);

  useEffect(() => {
    fetchModels();
    fetchMakes();
  }, [fetchModels, fetchMakes]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openCreate = () => {
    setEditingModel(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (model: ModelDto) => {
    setEditingModel(model);
    // Backend returns a single localized `name`; pre-populate the active language's field
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
          await fetchModels(true);
          setDialogOpen(false);
        } else {
          error(t("admin.models.createError"), { description: res.message });
        }
      }
    } catch {
      error(
        editingModel
          ? t("admin.models.updateError")
          : t("admin.models.createError")
      );
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
        success(
          model.isActive
            ? t("admin.models.deactivated")
            : t("admin.models.activated")
        );
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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {t("admin.models.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.models.subtitle")}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          {t("admin.models.addModel")}
        </Button>
      </div>

      {/* Models table */}
      <div className="rounded-2xl border border-border/80 bg-card/95 shadow-elevated overflow-hidden">
        <Table>
          <TableCaption className="px-4 pb-3 pt-2 text-xs text-muted-foreground">
            {t("admin.models.caption", { count: totalItems })}
          </TableCaption>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.models.name")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.models.make")}
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.models.status")}
              </TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground/90">
                {t("admin.models.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-24 ms-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : pageModels.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-12"
                >
                  {t("admin.models.empty")}
                </TableCell>
              </TableRow>
            ) : (
              pageModels.map((model) => (
                <TableRow
                  key={model.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <TableCell className="font-medium text-foreground">
                    {model.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {model.makeName}
                  </TableCell>
                  <TableCell>
                    <Badge variant={model.isActive ? "default" : "secondary"}>
                      {model.isActive
                        ? t("admin.models.active")
                        : t("admin.models.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(model)}
                        className="h-8 w-8 p-0"
                        title={t("admin.models.edit")}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(model)}
                        className="h-8 w-8 p-0"
                        title={
                          model.isActive
                            ? t("admin.models.deactivateBtn")
                            : t("admin.models.activateBtn")
                        }
                      >
                        {model.isActive ? (
                          <PowerOff className="size-4 text-amber-500" />
                        ) : (
                          <Power className="size-4 text-emerald-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(model)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title={t("admin.models.delete")}
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
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
          totalItems={totalItems}
          rowsPerPageLabel={t("admin.common.rowsPerPage")}
        />
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={editingModel ? "sm:max-w-md" : "sm:max-w-lg"}>
          <DialogHeader>
            <DialogTitle>
              {editingModel
                ? t("admin.models.editTitle")
                : t("admin.models.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingModel
                ? t("admin.models.editDescription")
                : t("admin.models.createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {editingModel ? (
              // Edit: language-specific name field only
              isArabic ? (
                <div className="space-y-1.5">
                  <Label htmlFor="model-nameAr">
                    {t("admin.models.nameAr")} (AR){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="model-nameAr"
                    value={formData.nameAr}
                    dir="rtl"
                    onChange={handleFieldChange("nameAr")}
                    placeholder="كامري"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="model-name">
                    {t("admin.models.name")} (EN){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="model-name"
                    value={formData.name}
                    onChange={handleFieldChange("name")}
                    placeholder="Camry"
                  />
                </div>
              )
            ) : (
              // Create: all name fields in 2-column grid
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="model-name">
                    {t("admin.models.name")} (EN){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="model-name"
                    value={formData.name}
                    onChange={handleFieldChange("name")}
                    placeholder="Camry"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="model-nameAr">
                    {t("admin.models.nameAr")} (AR){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="model-nameAr"
                    value={formData.nameAr}
                    dir="rtl"
                    onChange={handleFieldChange("nameAr")}
                    placeholder="كامري"
                  />
                </div>
              </div>
            )}

            {/* Make selector — always visible */}
            <div className="space-y-1.5">
              <Label>
                {t("admin.models.make")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Combobox
                value={formData.makeId}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, makeId: v }))
                }
                options={makes
                  .filter((m) => m.isActive)
                  .map((make) => ({
                    value: make.id,
                    label: make.name,
                  }))}
                placeholder={t("admin.models.selectMake")}
                searchPlaceholder={t("admin.models.searchMake")}
                emptyText={t("admin.models.noMakeFound")}
              />
            </div>

            {editingModel && (
              <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
                <span>{t("admin.models.langHint")}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              {t("buttons.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("admin.models.saving")}
                </>
              ) : (
                t("buttons.save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("admin.models.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.models.deleteDescription", {
                name: deleteTarget?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              {t("buttons.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
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
