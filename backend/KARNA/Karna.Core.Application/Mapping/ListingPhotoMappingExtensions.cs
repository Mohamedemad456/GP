using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Application.Abstraction.DTOs.ListingPhoto;
using Karna.Core.Domain.Entities;
using Microsoft.AspNetCore.Http;

namespace Karna.Core.Application.Mapping
{
    internal static class ListingPhotoMappingExtensions
    {
        public static ListingPhotoDto ToDto(this ListingPhoto photo)
        {
            return new ListingPhotoDto
            {
                Id = photo.Id,
                PhotoUrl = photo.PhotoUrl,
                IsPrimary = photo.IsPrimary,
                DisplayOrder = photo.DisplayOrder

            };
        }

        public static IEnumerable<ListingPhotoDto> ToDto(this IEnumerable<ListingPhoto> photos) =>
        photos.Select(x => x.ToDto());

        public static ListingPhoto ToEntity(this IFormFile file,Guid listingId,
                                            string photoUrl, int displayOrder, bool isPrimary)
        {
			ArgumentNullException.ThrowIfNull(file);
			return new ListingPhoto
            {
                ListingId = listingId,
                PhotoUrl = photoUrl,
                DisplayOrder = displayOrder,
                IsPrimary = isPrimary,
                UploadedAt = DateTime.UtcNow
            };
        }

    }
}
