using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Listing;

namespace Karna.Core.Application.Abstraction.Services
{
    public interface IFavoriteService
    {
        Task<ApiResponseDto> AddAsync(Guid listingId);
        Task<ApiResponseDto> RemoveAsync(Guid listingId);
        Task<ApiResponse<Pagination<BuyerListingDto>>> GetUserFavoritesAsync(PaginationSpecParams specParams);

    }
}
