using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Listing;

namespace Karna.Core.Application.Abstraction.Services
{
	public interface IListingService
	{
		Task<ApiResponse<ListingDto>> CreateAsync(CreateListingDto dto);
		Task<ApiResponse<ListingDto>> UpdateAsync(Guid listingId, UpdateListingDto dto);
		Task<ApiResponse<IEnumerable<ListingDefectDto>>> AddChecklistAsync(Guid listingId, AddConditionChecklistDto dto);

		Task<ApiResponse<ListingDto>> SubmitAsync(Guid listingId);
		Task<ApiResponse<ListingDto>> MarkAsSoldAsync(Guid listingId);

		Task<ApiResponse<IEnumerable<ListingStatusHistoryDto>>> GetStatusHistoryAsync(Guid listingId);
		Task<ApiResponse<IEnumerable<PricingHistoryDto>>> GetPricingHistoryAsync(Guid listingId);
        Task<ApiResponseDto> DeleteAsync(Guid id);

		Task<ApiResponse<GeneratePriceResponseDto>> GeneratePriceAsync(Guid listingId);
		Task<ApiResponse<ListingDto>> SetPriceAsync(Guid listingId, SetListingPriceDto dto);

		Task<ApiResponse<Pagination<BuyerListingDto>>> GetApprovedListingsAsync(BuyerListingSpecParams specParams);
		Task<ApiResponse<Pagination<MyListingDto>>> GetMyListingsAsync(MyListingSpecParams specParams);
		Task<ApiResponse<MyListingDetailsDto>> GetMyListingDetailsAsync(Guid listingId);
		Task<ApiResponse<ListingDetailsDto>> GetByIdAsync(Guid id);
	}
}