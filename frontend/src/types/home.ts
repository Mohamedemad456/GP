/**
 * Types for the Home page
 */

export type CarListing = {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileageKm: number;
  fuel: "Gasoline" | "Hybrid" | "Electric";
  transmission: "Automatic" | "Manual";
  bodyType: "Sedan" | "SUV" | "Hatchback" | "Coupe" | "Pickup";
  location: string;
  featured?: boolean;
};
