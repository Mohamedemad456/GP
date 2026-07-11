import { api } from "./api";
import type { ApiResponse } from "./authApi";
import type { ListingDto, RejectListingRequest } from "./listingsApi";
import type { PaginatedResponse, PaginationSpecParams } from "./makesApi";

export type PendingListingDto = {
  id: string;
  sellerId: string;
  sellerName: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  price: number | null;
  fairPrice: number | null;
  status: string;
  createdAt: string;
};

export type PendingListingSpecParams = PaginationSpecParams & {
  makeId?: string;
  modelId?: string;
  sellerId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export const getPendingListings = (params?: PendingListingSpecParams) =>
  api
    .get<ApiResponse<PaginatedResponse<PendingListingDto>>>(
      "/api/admin/listings/pending",
      { params },
    )
    .then((r) => r.data);


/**
 * PATCH /api/admin/listings/{id}/approve
 * Approves a Pending listing (Admin only).
 */
export const approveListing = (listingId: string) =>
  api
    .patch<ApiResponse<ListingDto>>(`/api/admin/listings/${listingId}/approve`)
    .then((r) => r.data);

/**
 * PATCH /api/admin/listings/{id}/reject
 * Rejects a Pending listing with an admin reason (Admin only).
 */
export const rejectListing = (listingId: string, data: RejectListingRequest) =>
  api
    .patch<ApiResponse<ListingDto>>(`/api/admin/listings/${listingId}/reject`, {
      Reason: data.reason ?? null,
    })
    .then((r) => r.data);

// ─── Admin Users & Logs DTOs ──────────────────────────────────────────────────

export type UserListDto = {
  userId: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: string;
};

export type UserListSpecParams = PaginationSpecParams & {
  isActive?: boolean;
};

export type AdminActivityLogDto = {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string | null;
  performedAt: string;
};

export type AdminActivityLogSpecParams = PaginationSpecParams & {
  adminId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
};

// ─── Admin Users & Logs Functions ────────────────────────────────────────────

/**
 * GET /api/admin/users
 * Fetches paginated list of users (Admin only).
 */
export const getAdminUsers = (params?: UserListSpecParams) =>
  api
    .get<ApiResponse<PaginatedResponse<UserListDto>>>("/api/admin/users", { params })
    .then((r) => r.data);

/**
 * PATCH /api/admin/users/{id}/toggle-status
 * Toggles a user's active/deactive status (Admin only).
 */
export const toggleUserStatus = (userId: string) =>
  api
    .patch<ApiResponse<UserListDto>>(`/api/admin/users/${userId}/toggle-status`)
    .then((r) => r.data);

/**
 * GET /api/admin/logs
 * Fetches admin activity logs (Admin only).
 */
export const getAdminLogs = (params?: AdminActivityLogSpecParams) =>
  api
    .get<ApiResponse<PaginatedResponse<AdminActivityLogDto>>>("/api/admin/logs", { params })
    .then((r) => r.data);