namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class MyListingDetailsDto
	{
		public Guid Id { get; set; }

		// ── Car Identity ─────────────────────────────────────────────
		public Guid MakeId { get; set; }
		public string MakeName { get; set; } = string.Empty;
		public Guid ModelId { get; set; }
		public string ModelName { get; set; } = string.Empty;

		// ── Car Specs ────────────────────────────────────────────────
		public int Year { get; set; }
		public int Mileage { get; set; }
		public string FuelType { get; set; } = string.Empty;
		public string Transmission { get; set; } = string.Empty;
		public decimal EngineSize { get; set; }
		public string Color { get; set; } = string.Empty;
		public string Description { get; set; } = string.Empty;
		public int LocationId { get; set; }
		public string LocationName { get; set; } = string.Empty;

		// ── Contact ──────────────────────────────────────────────────
		public string ContactPhoneNumber { get; set; } = string.Empty;
		public string? WhatsAppNumber { get; set; }
		public string PreferredContactMethod { get; set; } = string.Empty;

		// ── Price ────────────────────────────────────────────────────
		public decimal? ListingPrice { get; set; }

		// ── ML Pricing (owner only) ───────────────────────────────────
		public decimal? FairPrice { get; set; }
		public decimal? NegotiationRangeLower { get; set; }
		public decimal? NegotiationRangeUpper { get; set; }
		public string? ConfidenceLevel { get; set; }
		public string? ModelVersion { get; set; }
		public DateTime? PredictedAt { get; set; }

		// ── Photos ───────────────────────────────────────────────────
		public List<ListingPhotoDto> Photos { get; set; } = new();

		// ── Condition ────────────────────────────────────────────────
		public string ConditionGrade { get; set; } = string.Empty;
		public List<MyListingChecklistCategoryDto> ChecklistCategories { get; set; } = new();

		// ── Status ───────────────────────────────────────────────────
		public string Status { get; set; } = string.Empty;
		public DateTime CreatedAt { get; set; }
		public DateTime? UpdatedAt { get; set; }

		// ── Rejection (only when Rejected) ───────────────────────────
		public string? RejectionReason { get; set; }

		// ── Progress ─────────────────────────────────────────────────
		public ListingProgressDto Progress { get; set; } = new();
	}

	public class MyListingChecklistCategoryDto
	{
		public Guid CategoryId { get; set; }
		public string CategoryName { get; set; } = string.Empty;
		public List<MyListingDefectItemDto> SelectedItems { get; set; } = new();
	}

	public class MyListingDefectItemDto
	{
		public Guid Id { get; set; }
		public string Name { get; set; } = string.Empty;
	}

	public class ListingProgressDto
	{
		public bool HasBasicInfo { get; set; }
		public bool HasPhotos { get; set; }
		public bool HasConditionChecklist { get; set; }
		public bool HasMLPricing { get; set; }
		public bool CanSubmit { get; set; }
		public int CompletionPercentage { get; set; }
	}
}
