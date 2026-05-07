using Karna.Core.Domain._Common;
using Karna.Core.Domain.Enums;

namespace Karna.Core.Domain.Entities
{
	public class ListingStatusHistory : BaseEntity
	{
		public Guid ListingId { get; set; }
		public Listing Listing { get; set; } = null!;

		public ListingStatus OldStatus { get; set; }
		public ListingStatus NewStatus { get; set; }

		public Guid? ChangedByUserId { get; set; }
		public User? ChangedByUser { get; set; }

		public string? Reason { get; set; }
		public DateTime ChangedAt { get; set; }
	}
}
