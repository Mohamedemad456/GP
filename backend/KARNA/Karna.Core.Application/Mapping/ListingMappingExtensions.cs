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
			Price = source.Price,
			Status = source.Status,
			CreatedAt = source.CreatedAt,
			UpdatedAt = source.UpdatedAt,
			SoldAt = source.SoldAt,
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
		}
	}
}