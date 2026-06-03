using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Admin;
using Karna.Core.Application.Abstraction.DTOs.Listing;

namespace Karna.Core.Application.Abstraction.Services
{
	public interface IAdminService
	{
		Task<ApiResponse<Pagination<UserListDto>>> GetUsersAsync(UserListSpecParams specParams);
		Task<ApiResponse<Pagination<PendingListingDto>>> GetPendingListingsAsync(PendingListingSpecParams specParams);
		Task<ApiResponse<ListingDto>> ApproveListingAsync(Guid listingId);
		Task<ApiResponse<ListingDto>> RejectListingAsync(Guid listingId, RejectListingDto dto);
	}
}
