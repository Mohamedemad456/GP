/**
 * Mock car models data layer.
 * Replace with API call when backend is ready.
 */

export type CarModel = {
  id: string;
  brand: string;
  name: string;
  logo: string;
};

/** Placeholder logo generator - creates a simple SVG with brand initial */
const createLogoUri = (letter: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#f3f4f6" stroke="#e5e7eb"/><text x="32" y="42" text-anchor="middle" font-size="28" font-weight="bold" fill="#374151" font-family="system-ui,sans-serif">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export const MOCK_CAR_MODELS: CarModel[] = [
  { id: "1", brand: "Toyota", name: "Camry", logo: createLogoUri("T") },
  { id: "2", brand: "Honda", name: "Accord", logo: createLogoUri("H") },
  { id: "3", brand: "BMW", name: "3 Series", logo: createLogoUri("B") },
  {
    id: "4",
    brand: "Mercedes-Benz",
    name: "C-Class",
    logo: createLogoUri("M"),
  },
  { id: "5", brand: "Audi", name: "A4", logo: createLogoUri("A") },
  { id: "6", brand: "Lexus", name: "ES", logo: createLogoUri("L") },
  { id: "7", brand: "Ford", name: "Mustang", logo: createLogoUri("F") },
  { id: "8", brand: "Chevrolet", name: "Camaro", logo: createLogoUri("C") },
  { id: "9", brand: "Nissan", name: "Altima", logo: createLogoUri("N") },
  { id: "10", brand: "Hyundai", name: "Sonata", logo: createLogoUri("H") },
  { id: "11", brand: "Kia", name: "Optima", logo: createLogoUri("K") },
  { id: "12", brand: "Volkswagen", name: "Passat", logo: createLogoUri("V") },
];
