namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class PricingHistoryDto
	{
		public decimal? OldPrice { get; set; }
		public decimal? NewPrice { get; set; }
		public decimal? OldFairPrice { get; set; }
		public decimal? NewFairPrice { get; set; }
		public string? ChangeReason { get; set; }
		public Guid? ChangedByUserId { get; set; }
		public DateTime ChangedAt { get; set; }
	}
}
