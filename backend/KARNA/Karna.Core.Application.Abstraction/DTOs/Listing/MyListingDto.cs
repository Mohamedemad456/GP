namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class MyListingDto
	{
		public Guid Id { get; set; }
		public string MakeName { get; set; } = string.Empty;
		public string ModelName { get; set; } = string.Empty;
		public int Year { get; set; }
		public decimal? ListingPrice { get; set; }
		public string Status { get; set; } = string.Empty;
		public string? PrimaryPhotoUrl { get; set; }
		public DateTime CreatedAt { get; set; }
		public DateTime? UpdatedAt { get; set; }
		public int CompletionPercentage { get; set; }
		public bool CanSubmit { get; set; }
	}
}
