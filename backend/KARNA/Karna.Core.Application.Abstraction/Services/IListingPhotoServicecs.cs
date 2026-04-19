using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.ListingPhoto;

namespace Karna.Core.Application.Abstraction.Services
{
    public interface IListingPhotoService
    {
        Task<ApiResponse<IEnumerable<ListingPhotoDto>>> UploadAsync(Guid listingId, UploadListingPhotosDto dto);
    }
}
