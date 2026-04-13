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

// GET /api/Lookups
export const getAllLookups = () =>
  api.get<RawLookupGroupDto[]>("/api/Lookups").then((r) =>
    r.data.map((group) => ({
      nameKey: group.name,
      options: group.options ?? [],
    }))
  );
