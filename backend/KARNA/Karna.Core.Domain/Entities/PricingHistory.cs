using Karna.Core.Domain._Common;

namespace Karna.Core.Domain.Entities
{
	public class PricingHistory : BaseEntity
	{
		public Guid ListingId { get; set; }
		public Listing Listing { get; set; } = null!;

		public decimal? OldPrice { get; set; }
		public decimal? NewPrice { get; set; }

		public decimal? OldFairPrice { get; set; }
		public decimal? NewFairPrice { get; set; }

		public string? ChangeReason { get; set; }

		public Guid? ChangedByUserId { get; set; }
		public User? ChangedByUser { get; set; }

		public DateTime ChangedAt { get; set; }
	}
}
