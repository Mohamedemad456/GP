using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Application.Abstraction.DTOs._Common;

namespace Karna.Core.Application.Abstraction.Services
{
    public interface IFavoriteService
    {
        Task<ApiResponseDto> AddAsync(Guid listingId);
    }
}
