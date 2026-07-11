import { api } from "./api";
import type { ApiResponse } from "./authApi";

const BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5082";

// Matches backend ApiResponseDto (no data payload)
export type BaseApiResponse = {
  success: boolean;
  message: string;
};

// Matches backend MakeDto — NameAr / CountryAr are not in the response DTO
export type MakeDto = {
  id: string;
  name: string;
  logoUrl: string | null;
  country: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
};

// Matches backend Pagination<T>
export type PaginatedResponse<T> = {
  data: T[];
  pageIndex: number;
  pageSize: number;
  count: number;
};

// Matches backend MakeSpecParams (extends PaginationSpecParams)
export type MakeSpecParams = {
  pageIndex?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  sortDirection?: string;
  isActive?: boolean;
};

// Matches backend PaginationSpecParams
export type PaginationSpecParams = {
  pageIndex?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  sortDirection?: string;
};

// Matches backend CreateMakeDto / UpdateMakeDto (NameAr + CountryAr ARE in request DTOs)
export type CreateMakeRequest = {
  name: string;
  nameAr: string;
  icon?: File;
  country?: string;
  countryAr?: string;
};

export type UpdateMakeRequest = CreateMakeRequest;

export const getMakeLogoUrl = (logoUrl: string | null): string => {
  if (!logoUrl) return "";
  if (logoUrl.startsWith("http") || logoUrl.startsWith("data:")) return logoUrl;
  return `${BASE_URL}${logoUrl}`;
};

// GET /api/Makes/Active  — AllowAnonymous
export const getActiveMakes = (params?: PaginationSpecParams) =>
  api
    .get<ApiResponse<PaginatedResponse<MakeDto>>>("/api/Makes/Active", { params })
    .then((r) => r.data);

// GET /api/Makes/All  — Admin
export const getAllMakes = (params?: MakeSpecParams) =>
  api
    .get<ApiResponse<PaginatedResponse<MakeDto>>>("/api/Makes/All", { params })
    .then((r) => r.data);

// GET /api/Makes/{id}  — AllowAnonymous
export const getMakeById = (id: string) =>
  api.get<ApiResponse<MakeDto>>(`/api/Makes/${id}`).then((r) => r.data);

const buildMakeFormData = (data: CreateMakeRequest): FormData => {
  const fd = new FormData();
  fd.append("Name", data.name);
  fd.append("NameAr", data.nameAr);
  if (data.icon) fd.append("Icon", data.icon);
  if (data.country) fd.append("Country", data.country);
  if (data.countryAr) fd.append("CountryAr", data.countryAr);
  return fd;
};

// POST /api/Makes/Create  — Admin
export const createMake = (data: CreateMakeRequest) =>
  api
    .post<ApiResponse<MakeDto>>("/api/Makes/Create", buildMakeFormData(data), {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);

// PUT /api/Makes/Update/{id}  — Admin
export const updateMake = (id: string, data: UpdateMakeRequest) =>
  api
    .put<
      ApiResponse<MakeDto>
    >(`/api/Makes/Update/${id}`, buildMakeFormData(data), { headers: { "Content-Type": "multipart/form-data" } })
    .then((r) => r.data);

// PATCH /api/Makes/Activate/{id}  — Admin  (returns ApiResponseDto, no data)
export const activateMake = (id: string) =>
  api.patch<BaseApiResponse>(`/api/Makes/Activate/${id}`).then((r) => r.data);

// PATCH /api/Makes/Deactivate/{id}  — Admin  (returns ApiResponseDto, no data)
export const deactivateMake = (id: string) =>
  api.patch<BaseApiResponse>(`/api/Makes/Deactivate/${id}`).then((r) => r.data);

// DELETE /api/Makes/Delete/{id}  — Admin  (returns ApiResponseDto, no data)
export const deleteMake = (id: string) =>
  api.delete<BaseApiResponse>(`/api/Makes/Delete/${id}`).then((r) => r.data);
