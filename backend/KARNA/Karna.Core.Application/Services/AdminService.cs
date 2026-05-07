using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Mapping;
using Karna.Core.Application.Specifications.Listings;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Services
{
	internal class AdminService(
		IUnitOfWork _unitOfWork
	) : IAdminService
	{
		public async Task<ApiResponse<Pagination<PendingListingDto>>> GetPendingListingsAsync(PendingListingSpecParams specParams)
		{
			var repo = _unitOfWork.GetRepository<Listing>();

			var dataSpec = new PendingListingsSpecification(specParams, applyPaging: true);
			var countSpec = new PendingListingsSpecification(specParams, applyPaging: false);

			var listings = await repo.GetAllWithSpecAsync(dataSpec);
			var count = await repo.GetCountAsync(countSpec);

			return new ApiResponse<Pagination<PendingListingDto>>
			{
				Success = true,
				Data = new Pagination<PendingListingDto>(specParams.PageIndex, specParams.PageSize, count)
				{
					Data = listings.ToPendingDto()
				}
			};
		}
	}
}
