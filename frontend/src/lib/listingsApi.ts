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
  status: ListingStatus;
  createdAt: string;
  updatedAt: string | null;
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
};

/** Matches backend AddConditionChecklistDto */
export type AddConditionChecklistRequest = {
  conditionDefectIds: string[];
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
