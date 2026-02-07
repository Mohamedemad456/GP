/**
 * Types for the Onboarding page and related components
 */

import type { CarModel } from "@/data/mocks/cars";

/** User role selected during onboarding */
export enum OnboardingRole {
  Buyer = "buyer",
  Seller = "seller",
}

export type RoleSlideProps = {
  onSelect: (role: OnboardingRole) => void;
  onSkip?: () => void;
};

export type FavoriteModelsSlideProps = {
  carModels: CarModel[];
  onSubmit: (selectedIds: string[]) => void;
};
