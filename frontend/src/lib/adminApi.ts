import { api } from "./api";
import type { ApiResponse } from "./authApi";
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
