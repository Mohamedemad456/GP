import { api } from "./api";
import type { ApiResponse } from "./authApi";
import type { BaseApiResponse, PaginatedResponse } from "./makesApi";

const ENDPOINT = "/api/ConditionDefects";

// ─── DTOs ───────────────────────────────────────────────────────────────────

export type ConditionDefectDto = {
  id: string;
  itemName: string;
  description: string | null;
  isActive: boolean;
  categoryId: string;
  categoryName: string;
  createdAt: string;
  updatedAt: string | null;
};

export type AdminConditionDefectDto = Omit<
  ConditionDefectDto,
  "itemName" | "description" | "categoryName"
> & {
  itemName: string;
  itemNameAr: string;
  description: string | null;
  descriptionAr: string | null;
  categoryName: string;
  categoryNameAr: string;
};

export type CreateConditionDefectRequest = {
  itemName: string;
  itemNameAr: string;
  description?: string;
  descriptionAr?: string;
  categoryId: string;
};

export type UpdateConditionDefectRequest = CreateConditionDefectRequest;

/** Matches backend ConditionDefectSpecParams */
export type ConditionDefectSpecParams = {
  pageIndex?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  sortDirection?: string;
  categoryId?: string;
  isActive?: boolean;
};

/** Paginated result with bilingual merge */
export type AdminDefectPagedResult = {
  success: boolean;
  message: string;
  data: AdminConditionDefectDto[];
  totalCount: number;
};

// ─── Internal helpers ────────────────────────────────────────────────────────

const getDefectsForLanguage = (
  language: "en" | "ar",
  params?: ConditionDefectSpecParams,
) =>
  api
    .get<ApiResponse<PaginatedResponse<ConditionDefectDto>>>(`${ENDPOINT}/All`, {
      headers: { "Accept-Language": language },
      params,
    })
    .then((r) => r.data);

const mergeConditionDefects = (
  englishItems: ConditionDefectDto[] = [],
  arabicItems: ConditionDefectDto[] = [],
): AdminConditionDefectDto[] => {
  const arabicMap = new Map(arabicItems.map((item) => [item.id, item]));
  return englishItems.map((item) => {
    const ar = arabicMap.get(item.id);
    return {
      ...item,
      itemNameAr: ar?.itemName ?? "",
      descriptionAr: ar?.description ?? null,
      categoryNameAr: ar?.categoryName ?? "",
    };
  });
};

// ─── Public API functions ────────────────────────────────────────────────────

/**
 * GET /api/ConditionDefects/Active — AllowAnonymous
 * Backend returns ApiResponse<Pagination<T>>; unwrapped to a flat array here.
 */
export const getActiveConditionDefects = (
  params?: Omit<ConditionDefectSpecParams, "categoryId" | "isActive">,
) =>
  api
    .get<ApiResponse<PaginatedResponse<ConditionDefectDto>>>(
      `${ENDPOINT}/Active`,
      { params },
    )
    .then(
      (r) =>
        ({
          success: r.data.success,
          message: r.data.message,
          data: r.data.data?.data ?? [],
        }) satisfies ApiResponse<ConditionDefectDto[]>,
    );

/**
 * GET /api/ConditionDefects/All — Admin
 * Fetches both language versions and merges them. Returns pagination metadata.
 */
export const getAllConditionDefects = async (
  params?: ConditionDefectSpecParams,
): Promise<AdminDefectPagedResult> => {
  const [enRes, arRes] = await Promise.all([
    getDefectsForLanguage("en", params),
    getDefectsForLanguage("ar", params),
  ]);

  return {
    success: enRes.success && arRes.success,
    message: enRes.message || arRes.message,
    data: mergeConditionDefects(
      enRes.data?.data ?? [],
      arRes.data?.data ?? [],
    ),
    totalCount: enRes.data?.count ?? 0,
  };
};

/** GET /api/ConditionDefects/{id} — Admin */
export const getConditionDefectById = async (id: string) => {
  const [enRes, arRes] = await Promise.all([
    api
      .get<ApiResponse<ConditionDefectDto>>(`${ENDPOINT}/${id}`, {
        headers: { "Accept-Language": "en" },
      })
      .then((r) => r.data),
    api
      .get<ApiResponse<ConditionDefectDto>>(`${ENDPOINT}/${id}`, {
        headers: { "Accept-Language": "ar" },
      })
      .then((r) => r.data),
  ]);

  return {
    success: enRes.success && arRes.success,
    message: enRes.message || arRes.message,
    data: enRes.data
      ? {
          ...enRes.data,
          itemNameAr: arRes.data?.itemName ?? "",
          descriptionAr: arRes.data?.description ?? null,
          categoryNameAr: arRes.data?.categoryName ?? "",
        }
      : undefined,
  } satisfies ApiResponse<AdminConditionDefectDto | undefined>;
};

/** POST /api/ConditionDefects/Create — Admin */
export const createConditionDefect = (data: CreateConditionDefectRequest) =>
  api
    .post<ApiResponse<ConditionDefectDto>>(`${ENDPOINT}/Create`, {
      ItemName: data.itemName,
      ItemNameAr: data.itemNameAr,
      Description: data.description?.trim() || null,
      DescriptionAr: data.descriptionAr?.trim() || null,
      CategoryId: data.categoryId,
    })
    .then((r) => r.data);

/** PUT /api/ConditionDefects/Update/{id} — Admin */
export const updateConditionDefect = (
  id: string,
  data: UpdateConditionDefectRequest,
) =>
  api
    .put<ApiResponse<ConditionDefectDto>>(`${ENDPOINT}/Update/${id}`, {
      ItemName: data.itemName,
      ItemNameAr: data.itemNameAr,
      Description: data.description?.trim() || null,
      DescriptionAr: data.descriptionAr?.trim() || null,
      CategoryId: data.categoryId,
    })
    .then((r) => r.data);

/** PATCH /api/ConditionDefects/Activate/{id} — Admin */
export const activateConditionDefect = (id: string) =>
  api.patch<BaseApiResponse>(`${ENDPOINT}/Activate/${id}`).then((r) => r.data);

/** PATCH /api/ConditionDefects/Deactivate/{id} — Admin */
export const deactivateConditionDefect = (id: string) =>
  api
    .patch<BaseApiResponse>(`${ENDPOINT}/Deactivate/${id}`)
    .then((r) => r.data);

/** DELETE /api/ConditionDefects/Delete/{id} — Admin */
export const deleteConditionDefect = (id: string) =>
  api.delete<BaseApiResponse>(`${ENDPOINT}/Delete/${id}`).then((r) => r.data);
