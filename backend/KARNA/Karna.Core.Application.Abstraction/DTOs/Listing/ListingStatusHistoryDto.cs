using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class ListingStatusHistoryDto
	{
		public ListingStatus OldStatus { get; set; }
		public ListingStatus NewStatus { get; set; }
		public Guid? ChangedByUserId { get; set; }
		public string? Reason { get; set; }
		public DateTime ChangedAt { get; set; }
	}
}
