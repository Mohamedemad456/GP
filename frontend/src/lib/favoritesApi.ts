import { api } from "./api";
import { type BuyerListingDto } from "./listingsApi";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  errors: string[];
};

export type Pagination<T> = {
  pageIndex: number;
  pageSize: number;
  count: number;
  data: T[];
};

export async function addFavorite(listingId: string): Promise<ApiResponse<null>> {
  const { data } = await api.post<ApiResponse<null>>(`/api/Favorite/${listingId}`);
  return data;
}

export async function removeFavorite(listingId: string): Promise<ApiResponse<null>> {
  const { data } = await api.delete<ApiResponse<null>>(`/api/Favorite/${listingId}`);
  return data;
}

export async function getFavorites(params?: {
  pageIndex?: number;
  pageSize?: number;
}): Promise<ApiResponse<Pagination<BuyerListingDto>>> {
  const { data } = await api.get<ApiResponse<Pagination<BuyerListingDto>>>("/api/Favorite", {
    params,
  });
  return data;
}
