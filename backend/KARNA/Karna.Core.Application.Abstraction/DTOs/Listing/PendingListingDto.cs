namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class PendingListingDto
	{
		public Guid Id { get; set; }
		public Guid SellerId { get; set; }
		public string SellerName { get; set; } = string.Empty;
		public string Make { get; set; } = string.Empty;
		public string Model { get; set; } = string.Empty;
		public int Year { get; set; }
		public int Mileage { get; set; }
		public decimal? Price { get; set; }
		public decimal? FairPrice { get; set; }
		public string Status { get; set; } = string.Empty;
		public DateTime CreatedAt { get; set; }
	}
}
