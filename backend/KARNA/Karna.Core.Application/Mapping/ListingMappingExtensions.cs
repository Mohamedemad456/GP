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
			Status = source.Status,
			CreatedAt = source.CreatedAt,
			UpdatedAt = source.UpdatedAt,
			FairPrice = source.FairPrice,
			NegotiationRangeLower = source.NegotiationRangeLower,
			NegotiationRangeUpper = source.NegotiationRangeUpper,
			ConfidenceLevel = source.ConfidenceLevel,
			ModelVersion = source.ModelVersion,
			PredictedAt = source.PredictedAt
		};
	}
}