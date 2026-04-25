import { api } from "./api";
import type { ApiResponse } from "./authApi";
import type { BaseApiResponse, PaginatedResponse } from "./makesApi";

export type ModelDto = {
  id: string;
  name: string;
  isActive: boolean;
  makeName: string;
  makeId: string;
  createdAt: string;
  updatedAt: string | null;
};

export type CreateModelRequest = {
  name: string;
  nameAr: string;
  makeId: string;
};

export type UpdateModelRequest = CreateModelRequest;

/** Matches backend ModelSpecParams (extends PaginationSpecParams) */
export type ModelSpecParams = {
  pageIndex?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  sortDirection?: string;
  makeId?: string;
  isActive?: boolean;
};

/**
 * GET /api/Models/Active — AllowAnonymous
 * Backend returns ApiResponse<Pagination<T>>; unwrapped to a flat array here.
 * The Active endpoint accepts PaginationSpecParams (no makeId/isActive filter).
 */
export const getActiveModels = (params?: Pick<ModelSpecParams, "pageIndex" | "pageSize" | "search">) =>
  api
    .get<ApiResponse<PaginatedResponse<ModelDto>>>("/api/Models/Active", { params })
    .then((r) => ({
      success: r.data.success,
      message: r.data.message,
      data: r.data.data?.data ?? [],
      count: r.data.data?.count ?? 0,
    }));

/**
 * GET /api/Models/All — Admin only
 * Accepts full ModelSpecParams including makeId and isActive filters.
 */
export const getAllModels = (params?: ModelSpecParams) =>
  api
    .get<ApiResponse<PaginatedResponse<ModelDto>>>("/api/Models/All", { params })
    .then((r) => r.data);

/** GET /api/Models/{id} — AllowAnonymous */
export const getModelById = (id: string) =>
  api.get<ApiResponse<ModelDto>>(`/api/Models/${id}`).then((r) => r.data);

/** POST /api/Models/Create — Admin */
export const createModel = (data: CreateModelRequest) =>
  api
    .post<ApiResponse<ModelDto>>("/api/Models/Create", {
      Name: data.name,
      NameAr: data.nameAr,
      MakeId: data.makeId,
    })
    .then((r) => r.data);

/** PUT /api/Models/Update/{id} — Admin */
export const updateModel = (id: string, data: UpdateModelRequest) =>
  api
    .put<ApiResponse<ModelDto>>(`/api/Models/Update/${id}`, {
      Name: data.name,
      NameAr: data.nameAr,
      MakeId: data.makeId,
    })
    .then((r) => r.data);

/** PATCH /api/Models/Activate/{id} — Admin */
export const activateModel = (id: string) =>
  api.patch<BaseApiResponse>(`/api/Models/Activate/${id}`).then((r) => r.data);

/** PATCH /api/Models/Deactivate/{id} — Admin */
export const deactivateModel = (id: string) =>
  api.patch<BaseApiResponse>(`/api/Models/Deactivate/${id}`).then((r) => r.data);

/** DELETE /api/Models/Delete/{id} — Admin */
export const deleteModel = (id: string) =>
  api.delete<BaseApiResponse>(`/api/Models/Delete/${id}`).then((r) => r.data);
