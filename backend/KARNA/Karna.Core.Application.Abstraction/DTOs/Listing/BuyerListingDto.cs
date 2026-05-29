namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class BuyerListingDto
	{
		public Guid Id { get; set; }
		public string MakeName { get; set; } = string.Empty;
		public string ModelName { get; set; } = string.Empty;
		public int Year { get; set; }
		public int Mileage { get; set; }
		public string FuelType { get; set; } = string.Empty;
		public string Transmission { get; set; } = string.Empty;
		public string Color { get; set; } = string.Empty;
		public decimal? ListingPrice { get; set; }
		public string Location { get; set; } = string.Empty;
		public string? PrimaryPhotoUrl { get; set; }
		public DateTime CreatedAt { get; set; }
		public bool IsGoodDeal { get; set; }
	}
}
