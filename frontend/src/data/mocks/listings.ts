export type CarListing = {
  id: number;
  sellerId: string;
  makeId: number;
  modelId: number;
  make: string;
  model: string;
  year: number;
  mileage: number;
  fuelType: string;
  transmission: string;
  engineSize: string;
  color: string;
  description: string;
  basePrice: number;
  totalDeductionPercentage: number;
  suggestedPrice: number;
  listingPrice: number;
  conditionGrade: string;
  status: string;
  rejectionReason: string | null;
  approvedByAdminId: string | null;
  viewCount: number;
  favoriteCount: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  soldAt: string | null;
  images: string[];
};

export const MOCK_LISTINGS: CarListing[] = [
  {
    id: 1001,
    sellerId: "usr-201",
    makeId: 1,
    modelId: 1,
    make: "Toyota",
    model: "Camry",
    year: 2023,
    mileage: 22000,
    fuelType: "Gasoline",
    transmission: "Automatic",
    engineSize: "2.5L",
    color: "Pearl White",
    description:
      "Clean Toyota Camry with full service history, one owner, and excellent fuel economy. Includes adaptive cruise and lane assist.",
    basePrice: 96000,
    totalDeductionPercentage: 6,
    suggestedPrice: 90240,
    listingPrice: 89500,
    conditionGrade: "A",
    status: "approved",
    rejectionReason: null,
    approvedByAdminId: "adm-1",
    viewCount: 214,
    favoriteCount: 61,
    createdAt: "2025-09-12T11:30:00Z",
    updatedAt: "2025-10-01T10:22:00Z",
    approvedAt: "2025-09-13T08:10:00Z",
    soldAt: null,
    images: [
      "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1606611013016-969c19ba27d5?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=1200&h=800&fit=crop",
    ],
  },
  {
    id: 1002,
    sellerId: "usr-202",
    makeId: 2,
    modelId: 2,
    make: "Honda",
    model: "Accord",
    year: 2022,
    mileage: 31000,
    fuelType: "Hybrid",
    transmission: "CVT",
    engineSize: "2.0L",
    color: "Lunar Silver",
    description:
      "Reliable Honda Accord Hybrid with excellent condition interior and advanced safety package. Great daily driver.",
    basePrice: 84000,
    totalDeductionPercentage: 9,
    suggestedPrice: 76320,
    listingPrice: 76900,
    conditionGrade: "A-",
    status: "approved",
    rejectionReason: null,
    approvedByAdminId: "adm-2",
    viewCount: 180,
    favoriteCount: 49,
    createdAt: "2025-08-09T14:00:00Z",
    updatedAt: "2025-09-17T09:08:00Z",
    approvedAt: "2025-08-10T07:55:00Z",
    soldAt: null,
    images: [
      "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1200&h=800&fit=crop",
    ],
  },
  {
    id: 1003,
    sellerId: "usr-203",
    makeId: 3,
    modelId: 3,
    make: "BMW",
    model: "330i",
    year: 2021,
    mileage: 47000,
    fuelType: "Gasoline",
    transmission: "Automatic",
    engineSize: "2.0L Turbo",
    color: "Alpine White",
    description:
      "BMW 330i M Sport with panoramic roof and Harman Kardon sound. Strong performance with premium comfort.",
    basePrice: 121000,
    totalDeductionPercentage: 12,
    suggestedPrice: 106480,
    listingPrice: 107900,
    conditionGrade: "B+",
    status: "approved",
    rejectionReason: null,
    approvedByAdminId: "adm-1",
    viewCount: 262,
    favoriteCount: 73,
    createdAt: "2025-07-02T08:42:00Z",
    updatedAt: "2025-09-03T12:30:00Z",
    approvedAt: "2025-07-03T09:00:00Z",
    soldAt: null,
    images: [
      "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1520050206757-06e0afe21e56?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&h=800&fit=crop",
    ],
  },
  {
    id: 1004,
    sellerId: "usr-204",
    makeId: 4,
    modelId: 4,
    make: "Mercedes-Benz",
    model: "C200",
    year: 2023,
    mileage: 19500,
    fuelType: "Gasoline",
    transmission: "9G-Tronic",
    engineSize: "1.5L Turbo",
    color: "Obsidian Black",
    description:
      "C200 AMG Line with ambient lighting, 360 camera, and pristine exterior. Always parked indoors.",
    basePrice: 146000,
    totalDeductionPercentage: 7,
    suggestedPrice: 135780,
    listingPrice: 136900,
    conditionGrade: "A+",
    status: "approved",
    rejectionReason: null,
    approvedByAdminId: "adm-3",
    viewCount: 301,
    favoriteCount: 95,
    createdAt: "2025-09-01T15:10:00Z",
    updatedAt: "2025-10-03T10:40:00Z",
    approvedAt: "2025-09-02T07:40:00Z",
    soldAt: null,
    images: [
      "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=1200&h=800&fit=crop",
    ],
  },
  {
    id: 1005,
    sellerId: "usr-205",
    makeId: 5,
    modelId: 5,
    make: "Nissan",
    model: "Patrol",
    year: 2024,
    mileage: 8900,
    fuelType: "Gasoline",
    transmission: "Automatic",
    engineSize: "5.6L V8",
    color: "Desert Sand",
    description:
      "Nissan Patrol Platinum, like-new condition with full options and off-road capability package.",
    basePrice: 262000,
    totalDeductionPercentage: 4,
    suggestedPrice: 251520,
    listingPrice: 252900,
    conditionGrade: "A+",
    status: "approved",
    rejectionReason: null,
    approvedByAdminId: "adm-2",
    viewCount: 389,
    favoriteCount: 124,
    createdAt: "2025-10-01T09:20:00Z",
    updatedAt: "2025-10-14T11:10:00Z",
    approvedAt: "2025-10-02T09:15:00Z",
    soldAt: null,
    images: [
      "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1551830820-330a71b99659?w=1200&h=800&fit=crop",
    ],
  },
  {
    id: 1006,
    sellerId: "usr-206",
    makeId: 6,
    modelId: 6,
    make: "Hyundai",
    model: "Sonata",
    year: 2021,
    mileage: 54000,
    fuelType: "Gasoline",
    transmission: "Automatic",
    engineSize: "2.5L",
    color: "Midnight Blue",
    description:
      "Hyundai Sonata with premium interior, Apple CarPlay, and regular dealer maintenance history.",
    basePrice: 64000,
    totalDeductionPercentage: 10,
    suggestedPrice: 57600,
    listingPrice: 58900,
    conditionGrade: "B",
    status: "approved",
    rejectionReason: null,
    approvedByAdminId: "adm-1",
    viewCount: 142,
    favoriteCount: 33,
    createdAt: "2025-06-22T10:00:00Z",
    updatedAt: "2025-09-11T12:44:00Z",
    approvedAt: "2025-06-23T08:22:00Z",
    soldAt: null,
    images: [
      "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?w=1200&h=800&fit=crop",
    ],
  },
];

