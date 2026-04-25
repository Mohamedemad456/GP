import { api } from "./api";
import type { ApiResponse } from "./authApi";
import type { BaseApiResponse, PaginatedResponse } from "./makesApi";

const ENDPOINT = "/api/ConditionChecklistCategories";

// ─── DTOs ───────────────────────────────────────────────────────────────────

export type ConditionChecklistCategoryDto = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
};

export type AdminConditionChecklistCategoryDto = ConditionChecklistCategoryDto & {
  nameAr: string;
};

export type CreateConditionChecklistCategoryRequest = {
  name: string;
  nameAr: string;
};

export type UpdateConditionChecklistCategoryRequest =
  CreateConditionChecklistCategoryRequest;

/** Matches backend ConditionChecklistCategorySpecParams */
export type ConditionChecklistCategorySpecParams = {
  pageIndex?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  sortDirection?: string;
  isActive?: boolean;
};

/** Paginated result with bilingual merge */
export type AdminCategoryPagedResult = {
  success: boolean;
  message: string;
  data: AdminConditionChecklistCategoryDto[];
  totalCount: number;
};

// ─── Internal helpers ────────────────────────────────────────────────────────

const getCategoriesForLanguage = (
  language: "en" | "ar",
  params?: ConditionChecklistCategorySpecParams,
) =>
  api
    .get<ApiResponse<PaginatedResponse<ConditionChecklistCategoryDto>>>(
      `${ENDPOINT}/All`,
      { headers: { "Accept-Language": language }, params },
    )
    .then((r) => r.data);

const mergeConditionChecklistCategories = (
  englishItems: ConditionChecklistCategoryDto[] = [],
  arabicItems: ConditionChecklistCategoryDto[] = [],
): AdminConditionChecklistCategoryDto[] => {
  const arabicNames = new Map(arabicItems.map((item) => [item.id, item.name]));
  return englishItems.map((item) => ({
    ...item,
    nameAr: arabicNames.get(item.id) ?? "",
  }));
};

// ─── Public API functions ────────────────────────────────────────────────────

/**
 * GET /api/ConditionChecklistCategories/Active — AllowAnonymous
 * Backend returns ApiResponse<Pagination<T>>; unwrapped to a flat array here.
 */
export const getActiveConditionChecklistCategories = () =>
  api
    .get<ApiResponse<PaginatedResponse<ConditionChecklistCategoryDto>>>(
      `${ENDPOINT}/Active`,
    )
    .then(
      (r) =>
        ({
          success: r.data.success,
          message: r.data.message,
          data: r.data.data?.data ?? [],
        }) satisfies ApiResponse<ConditionChecklistCategoryDto[]>,
    );

/**
 * GET /api/ConditionChecklistCategories/All — Admin
 * Fetches both language versions and merges them. Returns pagination metadata.
 */
export const getAllConditionChecklistCategories = async (
  params?: ConditionChecklistCategorySpecParams,
): Promise<AdminCategoryPagedResult> => {
  const [enRes, arRes] = await Promise.all([
    getCategoriesForLanguage("en", params),
    getCategoriesForLanguage("ar", params),
  ]);

  return {
    success: enRes.success && arRes.success,
    message: enRes.message || arRes.message,
    data: mergeConditionChecklistCategories(
      enRes.data?.data ?? [],
      arRes.data?.data ?? [],
    ),
    totalCount: enRes.data?.count ?? 0,
  };
};

/** GET /api/ConditionChecklistCategories/{id} — Admin */
export const getConditionChecklistCategoryById = async (id: string) => {
  const [enRes, arRes] = await Promise.all([
    api
      .get<ApiResponse<ConditionChecklistCategoryDto>>(`${ENDPOINT}/${id}`, {
        headers: { "Accept-Language": "en" },
      })
      .then((r) => r.data),
    api
      .get<ApiResponse<ConditionChecklistCategoryDto>>(`${ENDPOINT}/${id}`, {
        headers: { "Accept-Language": "ar" },
      })
      .then((r) => r.data),
  ]);

  return {
    success: enRes.success && arRes.success,
    message: enRes.message || arRes.message,
    data: enRes.data
      ? { ...enRes.data, nameAr: arRes.data?.name ?? "" }
      : undefined,
  } satisfies ApiResponse<AdminConditionChecklistCategoryDto | undefined>;
};

/** POST /api/ConditionChecklistCategories/Create — Admin */
export const createConditionChecklistCategory = (
  data: CreateConditionChecklistCategoryRequest,
) =>
  api
    .post<ApiResponse<ConditionChecklistCategoryDto>>(`${ENDPOINT}/Create`, {
      Name: data.name,
      NameAr: data.nameAr,
    })
    .then((r) => r.data);

/** PUT /api/ConditionChecklistCategories/Update/{id} — Admin */
export const updateConditionChecklistCategory = (
  id: string,
  data: UpdateConditionChecklistCategoryRequest,
) =>
  api
    .put<ApiResponse<ConditionChecklistCategoryDto>>(
      `${ENDPOINT}/Update/${id}`,
      { Name: data.name, NameAr: data.nameAr },
    )
    .then((r) => r.data);

/** PATCH /api/ConditionChecklistCategories/Activate/{id} — Admin */
export const activateConditionChecklistCategory = (id: string) =>
  api.patch<BaseApiResponse>(`${ENDPOINT}/Activate/${id}`).then((r) => r.data);

/** PATCH /api/ConditionChecklistCategories/Deactivate/{id} — Admin */
export const deactivateConditionChecklistCategory = (id: string) =>
  api
    .patch<BaseApiResponse>(`${ENDPOINT}/Deactivate/${id}`)
    .then((r) => r.data);

/** DELETE /api/ConditionChecklistCategories/Delete/{id} — Admin */
export const deleteConditionChecklistCategory = (id: string) =>
  api.delete<BaseApiResponse>(`${ENDPOINT}/Delete/${id}`).then((r) => r.data);
