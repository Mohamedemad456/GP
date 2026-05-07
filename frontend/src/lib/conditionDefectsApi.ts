import { api } from "./api";
import type { ApiResponse } from "./authApi";
import type { BaseApiResponse } from "./makesApi";

const CONDITION_DEFECTS_ENDPOINT = "/api/ConditionDefects";

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

const getConditionDefectsForLanguage = (language: "en" | "ar") =>
  api
    .get<ApiResponse<ConditionDefectDto[]>>(`${CONDITION_DEFECTS_ENDPOINT}/All`, {
      headers: { "Accept-Language": language },
    })
    .then((r) => r.data);

const mergeConditionDefects = (
  englishItems: ConditionDefectDto[] = [],
  arabicItems: ConditionDefectDto[] = [],
): AdminConditionDefectDto[] => {
  const arabicItemsMap = new Map(arabicItems.map((item) => [item.id, item]));

  return englishItems.map((item) => {
    const arabicItem = arabicItemsMap.get(item.id);

    return {
      ...item,
      itemNameAr: arabicItem?.itemName ?? "",
      descriptionAr: arabicItem?.description ?? null,
      categoryNameAr: arabicItem?.categoryName ?? "",
    };
  });
};

// GET /api/ConditionDefects/Active  — AllowAnonymous
export const getActiveConditionDefects = () =>
  api
    .get<ApiResponse<ConditionDefectDto[]>>(`${CONDITION_DEFECTS_ENDPOINT}/Active`)
    .then((r) => r.data);

// GET /api/ConditionDefects/All  — Admin
export const getAllConditionDefects = async () => {
  const [englishResponse, arabicResponse] = await Promise.all([
    getConditionDefectsForLanguage("en"),
    getConditionDefectsForLanguage("ar"),
  ]);

  return {
    success: englishResponse.success && arabicResponse.success,
    message: englishResponse.message || arabicResponse.message,
    data: mergeConditionDefects(
      englishResponse.data ?? [],
      arabicResponse.data ?? [],
    ),
  } satisfies ApiResponse<AdminConditionDefectDto[]>;
};

// GET /api/ConditionDefects/{id}  — Admin/AllowAnonymous based on auth
export const getConditionDefectById = async (id: string) => {
  const [englishResponse, arabicResponse] = await Promise.all([
    api
      .get<ApiResponse<ConditionDefectDto>>(`${CONDITION_DEFECTS_ENDPOINT}/${id}`, {
        headers: { "Accept-Language": "en" },
      })
      .then((r) => r.data),
    api
      .get<ApiResponse<ConditionDefectDto>>(`${CONDITION_DEFECTS_ENDPOINT}/${id}`, {
        headers: { "Accept-Language": "ar" },
      })
      .then((r) => r.data),
  ]);

  return {
    success: englishResponse.success && arabicResponse.success,
    message: englishResponse.message || arabicResponse.message,
    data: englishResponse.data
      ? {
          ...englishResponse.data,
          itemNameAr: arabicResponse.data?.itemName ?? "",
          descriptionAr: arabicResponse.data?.description ?? null,
          categoryNameAr: arabicResponse.data?.categoryName ?? "",
        }
      : undefined,
  } satisfies ApiResponse<AdminConditionDefectDto | undefined>;
};

// POST /api/ConditionDefects/Create  — Admin
export const createConditionDefect = (data: CreateConditionDefectRequest) =>
  api
    .post<ApiResponse<ConditionDefectDto>>(`${CONDITION_DEFECTS_ENDPOINT}/Create`, {
      ItemName: data.itemName,
      ItemNameAr: data.itemNameAr,
      Description: data.description?.trim() || null,
      DescriptionAr: data.descriptionAr?.trim() || null,
      CategoryId: data.categoryId,
    })
    .then((r) => r.data);

// PUT /api/ConditionDefects/Update/{id}  — Admin
export const updateConditionDefect = (
  id: string,
  data: UpdateConditionDefectRequest,
) =>
  api
    .put<ApiResponse<ConditionDefectDto>>(
      `${CONDITION_DEFECTS_ENDPOINT}/Update/${id}`,
      {
        ItemName: data.itemName,
        ItemNameAr: data.itemNameAr,
        Description: data.description?.trim() || null,
        DescriptionAr: data.descriptionAr?.trim() || null,
        CategoryId: data.categoryId,
      },
    )
    .then((r) => r.data);

// PATCH /api/ConditionDefects/Activate/{id}  — Admin
export const activateConditionDefect = (id: string) =>
  api
    .patch<BaseApiResponse>(`${CONDITION_DEFECTS_ENDPOINT}/Activate/${id}`)
    .then((r) => r.data);

// PATCH /api/ConditionDefects/Deactivate/{id}  — Admin
export const deactivateConditionDefect = (id: string) =>
  api
    .patch<BaseApiResponse>(`${CONDITION_DEFECTS_ENDPOINT}/Deactivate/${id}`)
    .then((r) => r.data);

// DELETE /api/ConditionDefects/Delete/{id}  — Admin
export const deleteConditionDefect = (id: string) =>
  api
    .delete<BaseApiResponse>(`${CONDITION_DEFECTS_ENDPOINT}/Delete/${id}`)
    .then((r) => r.data);
