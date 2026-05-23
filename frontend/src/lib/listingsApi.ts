import { api } from "./api";
import type { ApiResponse } from "./authApi";

// ─── Enums (mirror backend Karna.Core.Domain.Enums) ────────────────────────

export const FuelType = {
  Gasoline: 1,
  Diesel: 2,
  Hybrid: 3,
  Electric: 4,
} as const;
export type FuelType = (typeof FuelType)[keyof typeof FuelType];

export const FuelTypeLabel: Record<FuelType, string> = {
  [FuelType.Gasoline]: "Gasoline",
  [FuelType.Diesel]: "Diesel",
  [FuelType.Hybrid]: "Hybrid",
  [FuelType.Electric]: "Electric",
};

export const TransmissionType = {
  Manual: 1,
  Automatic: 2,
} as const;
export type TransmissionType = (typeof TransmissionType)[keyof typeof TransmissionType];

export const TransmissionTypeLabel: Record<TransmissionType, string> = {
  [TransmissionType.Manual]: "Manual",
  [TransmissionType.Automatic]: "Automatic",
};

export const ListingStatus = {
  Draft: 1,
  Pending: 2,
  Active: 3,
  Rejected: 4,
  Sold: 5,
  Archived: 6,
} as const;
export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

export const ListingStatusLabel: Record<ListingStatus, string> = {
  [ListingStatus.Draft]: "Draft",
  [ListingStatus.Pending]: "Pending",
  [ListingStatus.Active]: "Active",
  [ListingStatus.Rejected]: "Rejected",
  [ListingStatus.Sold]: "Sold",
  [ListingStatus.Archived]: "Archived",
};

// EgyptLocation is a backend enum (EgyptLocation.cs) but the frontend fetches
// user-facing labels from /api/Lookups, so we only model the numeric value here.
export type EgyptLocation = number;

export type ApiResponseDto = {
  success: boolean;
  message: string;
};

// ─── DTOs (mirror backend Karna.Core.Application.Abstraction.DTOs) ──────────

/** Matches backend ListingDto */
export type ListingDto = {
  id: string;
  sellerId: string;
  makeId: string;
  modelId: string;
  year: number;
  mileage: number;
  fuelType: FuelType;
  transmission: TransmissionType;
  engineSize: number;
  color: string;
  description: string;
  location: EgyptLocation;
  price: number | null;
  status: ListingStatus;
  createdAt: string;
  updatedAt: string | null;
  soldAt: string | null;

  // ML Pricing Fields
  fairPrice: number | null;
  negotiationRangeLower: number | null;
  negotiationRangeUpper: number | null;
  confidenceLevel: string | null;
  modelVersion: string | null;
  predictedAt: string | null;
};

/** Matches backend ListingDefectDto */
export type ListingDefectDto = {
  conditionDefectId: string;
  categoryName: string;
  itemName: string;
};

/** Matches backend ListingPhotoDto */
export type ListingPhotoDto = {
  id: string;
  photoUrl: string;
  isPrimary: boolean;
  displayOrder: number;
};

/** Matches backend CreateListingDto */
export type CreateListingRequest = {
  makeId: string;
  modelId: string;
  year: number;
  mileage: number;
  fuelType: FuelType;
  transmission: TransmissionType;
  engineSize: number;
  color: string;
  description: string;
  location: EgyptLocation;
};

/** Matches backend AddConditionChecklistDto */
export type AddConditionChecklistRequest = {
  conditionDefectIds: string[];
};

/** Matches backend UpdateListingDto */
export type UpdateListingRequest = {
  makeId: string;
  modelId: string;
  year: number;
  mileage: number;
  fuelType: FuelType;
  transmission: TransmissionType;
  engineSize: number;
  color: string;
  description: string;
  location: EgyptLocation;
};

/** Matches backend RejectListingDto */
export type RejectListingRequest = {
  reason?: string | null;
};

/** Matches backend SetListingPriceDto */
export type SetListingPriceRequest = {
  price?: number | null;
  acceptFairPrice: boolean;
};

export type ListingStatusHistoryDto = {
  oldStatus: ListingStatus;
  newStatus: ListingStatus;
  changedByUserId: string | null;
  reason: string | null;
  changedAt: string;
};

export type PriceFactorDto = {
  factor: string;
  direction: string;
  description: string;
};

export type GeneratePriceResponseDto = {
  fairPrice: number;
  negotiationRangeLower: number;
  negotiationRangeUpper: number;
  confidenceLevel: string;
  priceFactors: PriceFactorDto[];
  modelVersion: string;
  predictedAt: string;
};

// ─── API functions ──────────────────────────────────────────────────────────

/**
 * POST /api/Listings
 * Creates a new car listing. Requires authenticated seller (User role).
 */
export const createListing = (data: CreateListingRequest) =>
  api
    .post<ApiResponse<ListingDto>>("/api/Listings", {
      MakeId: data.makeId,
      ModelId: data.modelId,
      Year: data.year,
      Mileage: data.mileage,
      FuelType: data.fuelType,
      Transmission: data.transmission,
      EngineSize: data.engineSize,
      Color: data.color,
      Description: data.description,
      Location: data.location,
    })
    .then((r) => r.data);

/**
 * POST /api/Listings/{id}/conditions
 * Attaches a condition checklist to a listing in Draft state. Seller only.
 */
export const addListingChecklist = (
  listingId: string,
  data: AddConditionChecklistRequest,
) =>
  api
    .post<ApiResponse<ListingDefectDto[]>>(
      `/api/Listings/${listingId}/conditions`,
      { ConditionDefectIds: data.conditionDefectIds },
    )
    .then((r) => r.data);

/**
 * POST /api/listings/{id}/photos
 * Uploads photos for a listing (multipart/form-data). Seller only.
 * Backend field name is "Files" per UploadListingPhotosDto.
 */
export const uploadListingPhotos = (listingId: string, files: File[]) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("Files", file));
  return api
    .post<ApiResponse<ListingPhotoDto[]>>(
      `/api/listings/${listingId}/photos`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    )
    .then((r) => r.data);
};

/**
 * PUT /api/Listings/{id}
 * Updates a seller-owned listing.
 */
export const updateListing = (listingId: string, data: UpdateListingRequest) =>
  api
    .put<ApiResponse<ListingDto>>(`/api/Listings/${listingId}`, {
      MakeId: data.makeId,
      ModelId: data.modelId,
      Year: data.year,
      Mileage: data.mileage,
      FuelType: data.fuelType,
      Transmission: data.transmission,
      EngineSize: data.engineSize,
      Color: data.color,
      Description: data.description,
      Location: data.location,
    })
    .then((r) => r.data);

/**
 * PATCH /api/Listings/{id}/submit
 * Submits a Draft listing for review.
 */
export const submitListing = (listingId: string) =>
  api
    .patch<ApiResponse<ListingDto>>(`/api/Listings/${listingId}/submit`)
    .then((r) => r.data);

/**
 * PATCH /api/Listings/{id}/approve
 * Approves a Pending listing (Admin only).
 */
export const approveListing = (listingId: string) =>
  api
    .patch<ApiResponse<ListingDto>>(`/api/Listings/${listingId}/approve`)
    .then((r) => r.data);

/**
 * PATCH /api/Listings/{id}/reject
 * Rejects a Pending listing with an admin reason (Admin only).
 */
export const rejectListing = (listingId: string, data: RejectListingRequest) =>
  api
    .patch<ApiResponse<ListingDto>>(`/api/Listings/${listingId}/reject`, {
      Reason: data.reason ?? null,
    })
    .then((r) => r.data);

/**
 * PATCH /api/Listings/{id}/sold
 * Marks an Active listing as Sold.
 */
export const markListingAsSold = (listingId: string) =>
  api
    .patch<ApiResponse<ListingDto>>(`/api/Listings/${listingId}/sold`)
    .then((r) => r.data);

/**
 * GET /api/Listings/{id}/status-history
 * Returns a listing’s status transition history.
 */
export const getListingStatusHistory = (listingId: string) =>
  api
    .get<ApiResponse<ListingStatusHistoryDto[]>>(
      `/api/Listings/${listingId}/status-history`,
    )
    .then((r) => r.data);

/**
 * DELETE /api/Listings/{id}
 * Archives (soft-deletes) a seller-owned listing.
 */
export const deleteListing = (listingId: string) =>
  api
    .delete<ApiResponseDto>(`/api/Listings/${listingId}`)
    .then((r) => r.data);

/**
 * POST /api/Listings/{id}/generate-price
 * Generates ML pricing and stores it on the listing.
 */
export const generateListingPrice = (listingId: string) =>
  api
    .post<ApiResponse<GeneratePriceResponseDto>>(
      `/api/Listings/${listingId}/generate-price`,
    )
    .then((r) => r.data);

/**
 * POST /api/Listings/{id}/set-price
 * Sets the final listing price using the generated fair price or a custom offer.
 */
export const setListingPrice = (listingId: string, data: SetListingPriceRequest) =>
  api
    .post<ApiResponse<ListingDto>>(`/api/Listings/${listingId}/set-price`, {
      Price: data.price ?? null,
      AcceptFairPrice: data.acceptFairPrice,
    })
    .then((r) => r.data);
