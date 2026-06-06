using Karna.Core.Application.Abstraction.DTOs._Common;

namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class MyListingSpecParams : PaginationSpecParams
	{
		public string? Status { get; set; }
		public Guid? MakeId { get; set; }
		public Guid? ModelId { get; set; }
	}
}
