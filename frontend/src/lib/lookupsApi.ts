import { api } from "./api";

export type LookupOptionDto = {
  value: number;
  label: string;
};

type RawLookupGroupDto = {
  name: string;
  options: LookupOptionDto[];
};

export type LookupGroupDto = {
  nameKey: string;
  options: LookupOptionDto[];
};

// GET /api/Lookups  — returns all lookup groups (FuelTypes, TransmissionTypes, ListingStatuses, …)
export const getAllLookups = () =>
  api.get<RawLookupGroupDto[]>("/api/Lookups").then((r) =>
    r.data.map((group) => ({
      nameKey: group.name,
      options: group.options ?? [],
    })),
  );

// GET /api/Lookups/fuel-types
export const getFuelTypes = () =>
  api
    .get<LookupOptionDto[]>("/api/Lookups/fuel-types")
    .then((r) => r.data);

// GET /api/Lookups/transmission-types
export const getTransmissionTypes = () =>
  api
    .get<LookupOptionDto[]>("/api/Lookups/transmission-types")
    .then((r) => r.data);

// GET /api/Lookups/listing-statuses
export const getListingStatuses = () =>
  api
    .get<LookupOptionDto[]>("/api/Lookups/listing-statuses")
    .then((r) => r.data);
