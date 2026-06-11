using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Mapping
{
    internal static class FavoriteMappingExtensions
    {
        public static BuyerListingDto ToBuyerListingDto(this Favorite source)
        {
            var isArabic = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "ar";

            var listing = source.Listing;

            return new BuyerListingDto
            {
                Id = listing.Id,

                MakeName = isArabic
                    ? (listing.Make?.NameAr ?? listing.Make?.Name ?? string.Empty)
                    : (listing.Make?.Name ?? listing.Make?.NameAr ?? string.Empty),

                ModelName = isArabic
                    ? (listing.Model?.NameAr ?? listing.Model?.Name ?? string.Empty)
                    : (listing.Model?.Name ?? listing.Model?.NameAr ?? string.Empty),

                Year = listing.Year,
                Mileage = listing.Mileage,

                FuelType = listing.FuelType.ToString(),
                Transmission = listing.Transmission.ToString(),

                Color = listing.Color,

                ListingPrice = listing.Price,

                Location = listing.Location.ToString(),

                CreatedAt = listing.CreatedAt,

                PrimaryPhotoUrl = listing.Photos
                    .FirstOrDefault(x => x.IsPrimary)?
                    .PhotoUrl,

                IsGoodDeal =
                    listing.Price.HasValue &&
                    listing.FairPrice.HasValue &&
                    listing.Price.Value < listing.FairPrice.Value
            };
        }

        public static IEnumerable<BuyerListingDto> ToBuyerListingDto(
            this IEnumerable<Favorite> source)
        {
            return source.Select(x => x.ToBuyerListingDto());
        }
    }
}
