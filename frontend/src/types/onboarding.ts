/**
 * Types for the Onboarding page and related components
 */

import type { CarModel } from "@/data/mocks/cars";

export type FavoriteModelsSlideProps = {
  carModels: CarModel[];
  onSubmit: (selectedIds: string[]) => void;
};
