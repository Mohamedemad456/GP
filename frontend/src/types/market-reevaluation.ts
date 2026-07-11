export interface Notification {
  id: string;
  userId: string;
  listingId?: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface ListingMLMetadata {
  fairPrice: number | null;
  negotiationRangeLower: number | null;
  negotiationRangeUpper: number | null;
  confidenceLevel: string | null;
  modelVersion: string | null;
  predictedAt: string | null;
}
