using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Listing;

namespace Karna.Core.Application.Abstraction.Services
{
	public interface IListingService
	{
		Task<ApiResponse<ListingDto>> CreateAsync(CreateListingDto dto);
		Task<ApiResponse<IEnumerable<ListingDefectDto>>> AddChecklistAsync(Guid listingId, AddConditionChecklistDto dto);
	}
}