using Karna.Core.Application.Abstraction.DTOs._Common;

namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class BuyerListingSpecParams : PaginationSpecParams
	{
		public Guid? MakeId { get; set; }
		public Guid? ModelId { get; set; }
		public int? YearFrom { get; set; }
		public int? YearTo { get; set; }
		public decimal? PriceMin { get; set; }
		public decimal? PriceMax { get; set; }
		public int? MileageMin { get; set; }
		public int? MileageMax { get; set; }
	}
}
