import { api } from "./api";
import type { ApiResponse } from "./authApi";
import type { BaseApiResponse } from "./makesApi";

export type ModelDto = {
  id: string;
  name: string;  // localized by backend based on Accept-Language
  isActive: boolean;
  makeName: string;  // localized by backend
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

// GET /api/Models/Active  — AllowAnonymous
export const getActiveModels = () =>
  api.get<ApiResponse<ModelDto[]>>("/api/Models/Active").then((r) => r.data);

// GET /api/Models/All  — Admin
export const getAllModels = () =>
  api.get<ApiResponse<ModelDto[]>>("/api/Models/All").then((r) => r.data);

// GET /api/Models/{id}  — AllowAnonymous
export const getModelById = (id: string) =>
  api.get<ApiResponse<ModelDto>>(`/api/Models/${id}`).then((r) => r.data);

// POST /api/Models/Create  — Admin
export const createModel = (data: CreateModelRequest) =>
  api
    .post<ApiResponse<ModelDto>>("/api/Models/Create", {
      Name: data.name,
      NameAr: data.nameAr,
      MakeId: data.makeId,
    })
    .then((r) => r.data);

// PUT /api/Models/Update/{id}  — Admin
export const updateModel = (id: string, data: UpdateModelRequest) =>
  api
    .put<ApiResponse<ModelDto>>(`/api/Models/Update/${id}`, {
      Name: data.name,
      NameAr: data.nameAr,
      MakeId: data.makeId,
    })
    .then((r) => r.data);

// PATCH /api/Models/Activate/{id}  — Admin
export const activateModel = (id: string) =>
  api.patch<BaseApiResponse>(`/api/Models/Activate/${id}`).then((r) => r.data);

// PATCH /api/Models/Deactivate/{id}  — Admin
export const deactivateModel = (id: string) =>
  api.patch<BaseApiResponse>(`/api/Models/Deactivate/${id}`).then((r) => r.data);

// DELETE /api/Models/Delete/{id}  — Admin
export const deleteModel = (id: string) =>
  api.delete<BaseApiResponse>(`/api/Models/Delete/${id}`).then((r) => r.data);
