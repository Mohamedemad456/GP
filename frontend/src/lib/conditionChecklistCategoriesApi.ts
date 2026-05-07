import { api } from "./api";
import type { ApiResponse } from "./authApi";
import type { BaseApiResponse } from "./makesApi";

const CONDITION_CHECKLIST_CATEGORIES_ENDPOINT =
  "/api/ConditionChecklistCategories";

export type ConditionChecklistCategoryDto = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
};

export type AdminConditionChecklistCategoryDto =
  ConditionChecklistCategoryDto & {
    nameAr: string;
  };

export type CreateConditionChecklistCategoryRequest = {
  name: string;
  nameAr: string;
};

export type UpdateConditionChecklistCategoryRequest =
  CreateConditionChecklistCategoryRequest;

const getConditionChecklistCategoriesForLanguage = (language: "en" | "ar") =>
  api
    .get<ApiResponse<ConditionChecklistCategoryDto[]>>(
      `${CONDITION_CHECKLIST_CATEGORIES_ENDPOINT}/All`,
      { headers: { "Accept-Language": language } },
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

// GET /api/ConditionChecklistCategories/Active  — AllowAnonymous
export const getActiveConditionChecklistCategories = () =>
  api
    .get<ApiResponse<ConditionChecklistCategoryDto[]>>(
      `${CONDITION_CHECKLIST_CATEGORIES_ENDPOINT}/Active`,
    )
    .then((r) => r.data);

// GET /api/ConditionChecklistCategories/All  — Admin
export const getAllConditionChecklistCategories = async () => {
  const [englishResponse, arabicResponse] = await Promise.all([
    getConditionChecklistCategoriesForLanguage("en"),
    getConditionChecklistCategoriesForLanguage("ar"),
  ]);

  return {
    success: englishResponse.success && arabicResponse.success,
    message: englishResponse.message || arabicResponse.message,
    data: mergeConditionChecklistCategories(
      englishResponse.data ?? [],
      arabicResponse.data ?? [],
    ),
  } satisfies ApiResponse<AdminConditionChecklistCategoryDto[]>;
};

// GET /api/ConditionChecklistCategories/{id}  — Admin/AllowAnonymous based on auth
export const getConditionChecklistCategoryById = async (id: string) => {
  const [englishResponse, arabicResponse] = await Promise.all([
    api
      .get<ApiResponse<ConditionChecklistCategoryDto>>(
        `${CONDITION_CHECKLIST_CATEGORIES_ENDPOINT}/${id}`,
        { headers: { "Accept-Language": "en" } },
      )
      .then((r) => r.data),
    api
      .get<ApiResponse<ConditionChecklistCategoryDto>>(
        `${CONDITION_CHECKLIST_CATEGORIES_ENDPOINT}/${id}`,
        { headers: { "Accept-Language": "ar" } },
      )
      .then((r) => r.data),
  ]);

  return {
    success: englishResponse.success && arabicResponse.success,
    message: englishResponse.message || arabicResponse.message,
    data: englishResponse.data
      ? {
          ...englishResponse.data,
          nameAr: arabicResponse.data?.name ?? "",
        }
      : undefined,
  } satisfies ApiResponse<AdminConditionChecklistCategoryDto | undefined>;
};

// POST /api/ConditionChecklistCategories/Create  — Admin
export const createConditionChecklistCategory = (
  data: CreateConditionChecklistCategoryRequest,
) =>
  api
    .post<ApiResponse<ConditionChecklistCategoryDto>>(
      `${CONDITION_CHECKLIST_CATEGORIES_ENDPOINT}/Create`,
      {
        Name: data.name,
        NameAr: data.nameAr,
      },
    )
    .then((r) => r.data);

// PUT /api/ConditionChecklistCategories/Update/{id}  — Admin
export const updateConditionChecklistCategory = (
  id: string,
  data: UpdateConditionChecklistCategoryRequest,
) =>
  api
    .put<ApiResponse<ConditionChecklistCategoryDto>>(
      `${CONDITION_CHECKLIST_CATEGORIES_ENDPOINT}/Update/${id}`,
      {
        Name: data.name,
        NameAr: data.nameAr,
      },
    )
    .then((r) => r.data);

// PATCH /api/ConditionChecklistCategories/Activate/{id}  — Admin
export const activateConditionChecklistCategory = (id: string) =>
  api
    .patch<BaseApiResponse>(
      `${CONDITION_CHECKLIST_CATEGORIES_ENDPOINT}/Activate/${id}`,
    )
    .then((r) => r.data);

// PATCH /api/ConditionChecklistCategories/Deactivate/{id}  — Admin
export const deactivateConditionChecklistCategory = (id: string) =>
  api
    .patch<BaseApiResponse>(
      `${CONDITION_CHECKLIST_CATEGORIES_ENDPOINT}/Deactivate/${id}`,
    )
    .then((r) => r.data);

// DELETE /api/ConditionChecklistCategories/Delete/{id}  — Admin
export const deleteConditionChecklistCategory = (id: string) =>
  api
    .delete<BaseApiResponse>(
      `${CONDITION_CHECKLIST_CATEGORIES_ENDPOINT}/Delete/${id}`,
    )
    .then((r) => r.data);
