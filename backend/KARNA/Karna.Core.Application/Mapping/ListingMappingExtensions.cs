using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Domain.Entities;
using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Mapping
{
	internal static class ListingMappingExtensions
	{
		public static Listing ToEntity(this CreateListingDto dto, Guid sellerId) => new()
		{
			SellerId = sellerId,
			MakeId = dto.MakeId,
			ModelId = dto.ModelId,
			Year = dto.Year,
			Mileage = dto.Mileage,
			FuelType = dto.FuelType,
			Transmission = dto.Transmission,
			EngineSize = dto.EngineSize,
			Color = dto.Color,
			Description = dto.Description,
			Location = dto.Location,
			ContactPhoneNumber = dto.ContactPhoneNumber,
			WhatsAppNumber = dto.WhatsAppNumber,
			PreferredContactMethod = dto.PreferredContactMethod,
			Status = ListingStatus.Draft
		};

		public static ListingDto ToDto(this Listing source) => new()
		{
			Id = source.Id,
			SellerId = source.SellerId,
			MakeId = source.MakeId,
			ModelId = source.ModelId,
			Year = source.Year,
			Mileage = source.Mileage,
			FuelType = source.FuelType,
			Transmission = source.Transmission,
			EngineSize = source.EngineSize,
			Color = source.Color,
			Description = source.Description,
			Location = source.Location,
			ContactPhoneNumber = source.ContactPhoneNumber,
			WhatsAppNumber = source.WhatsAppNumber,
			PreferredContactMethod = source.PreferredContactMethod,
			Price = source.Price,
			Status = source.Status,
			CreatedAt = source.CreatedAt,
			UpdatedAt = source.UpdatedAt,
			SoldAt = source.SoldAt,
			ApprovedAt = source.ApprovedAt,
			RejectionReason = source.RejectionReason,
			FairPrice = source.FairPrice,
			NegotiationRangeLower = source.NegotiationRangeLower,
			NegotiationRangeUpper = source.NegotiationRangeUpper,
			ConfidenceLevel = source.ConfidenceLevel,
			ModelVersion = source.ModelVersion,
			PredictedAt = source.PredictedAt
		};

		public static void ApplyUpdate(this Listing listing, UpdateListingDto dto)
		{
			listing.MakeId = dto.MakeId;
			listing.ModelId = dto.ModelId;
			listing.Year = dto.Year;
			listing.Mileage = dto.Mileage;
			listing.FuelType = dto.FuelType;
			listing.Transmission = dto.Transmission;
			listing.EngineSize = dto.EngineSize;
			listing.Color = dto.Color;
			listing.Description = dto.Description;
			listing.Location = dto.Location;
			listing.ContactPhoneNumber = dto.ContactPhoneNumber;
			listing.WhatsAppNumber = dto.WhatsAppNumber;
			listing.PreferredContactMethod = dto.PreferredContactMethod;
		}

		public static PendingListingDto ToPendingDto(this Listing source) => new()
		{
			Id = source.Id,
			SellerId = source.SellerId,
			SellerName = source.Seller?.Name ?? string.Empty,
			Make = source.Make?.Name ?? string.Empty,
			Model = source.Model?.Name ?? string.Empty,
			Year = source.Year,
			Mileage = source.Mileage,
			Price = source.Price,
			FairPrice = source.FairPrice,
			Status = source.Status.ToString(),
			CreatedAt = source.CreatedAt
		};

		public static IEnumerable<PendingListingDto> ToPendingDto(this IEnumerable<Listing> source)
			=> source.Select(l => l.ToPendingDto());

		public static BuyerListingDto ToBuyerDto(this Listing source) => new()
		{
			Id = source.Id,
			MakeName = source.Make?.Name ?? string.Empty,
			ModelName = source.Model?.Name ?? string.Empty,
			Year = source.Year,
			Mileage = source.Mileage,
			FuelType = source.FuelType.ToString(),
			Transmission = source.Transmission.ToString(),
			Color = source.Color,
			ListingPrice = source.Price,
			PrimaryPhotoUrl = source.Photos?.FirstOrDefault(p => p.IsPrimary)?.PhotoUrl,
			CreatedAt = source.CreatedAt,
			IsGoodDeal = CalculateIsGoodDeal(source)
		};

		public static IEnumerable<BuyerListingDto> ToBuyerDto(this IEnumerable<Listing> source)
			=> source.Select(l => l.ToBuyerDto());

		private static bool CalculateIsGoodDeal(Listing listing)
		{
			if (listing.Price is null)
				return false;

			var isBelowFairPrice = listing.FairPrice.HasValue
				&& listing.Price < listing.FairPrice;

			var isAtOrBelowLowerRange = listing.NegotiationRangeLower.HasValue
				&& listing.Price <= listing.NegotiationRangeLower;

			return isBelowFairPrice || isAtOrBelowLowerRange;
		}
	}
}