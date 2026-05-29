namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class ListingDetailsDto
	{
		public Guid Id { get; set; }

		// Car Specs
		public string MakeName { get; set; } = string.Empty;
		public string ModelName { get; set; } = string.Empty;
		public int Year { get; set; }
		public int Mileage { get; set; }
		public string FuelType { get; set; } = string.Empty;
		public string Transmission { get; set; } = string.Empty;
		public decimal EngineSize { get; set; }
		public string Color { get; set; } = string.Empty;
		public string Description { get; set; } = string.Empty;
		public string Location { get; set; } = string.Empty;

		// Price
		public decimal? ListingPrice { get; set; }
		public bool IsGoodDeal { get; set; }

		// Photos (primary first)
		public List<ListingPhotoDto> Photos { get; set; } = new();

		// Condition
		public string ConditionGrade { get; set; } = string.Empty;
		public List<ConditionCategoryDetailDto> ChecklistCategories { get; set; } = new();

		// Seller Contact
		public string SellerName { get; set; } = string.Empty;
		public string ContactPhoneNumber { get; set; } = string.Empty;
		public string? WhatsAppNumber { get; set; }
		public string PreferredContactMethod { get; set; } = string.Empty;

		public DateTime CreatedAt { get; set; }
	}
}
