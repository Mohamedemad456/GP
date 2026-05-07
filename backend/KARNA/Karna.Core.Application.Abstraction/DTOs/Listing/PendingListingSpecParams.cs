using Karna.Core.Application.Abstraction.DTOs._Common;

namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class PendingListingSpecParams : PaginationSpecParams
	{
		public Guid? MakeId { get; set; }
		public Guid? ModelId { get; set; }
		public Guid? SellerId { get; set; }
		public DateTime? DateFrom { get; set; }
		public DateTime? DateTo { get; set; }
	}
}
