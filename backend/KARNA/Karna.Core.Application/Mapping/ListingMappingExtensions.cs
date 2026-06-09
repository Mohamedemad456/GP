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
			Location = source.Location.ToDisplayString(),
			PrimaryPhotoUrl = source.Photos?.FirstOrDefault(p => p.IsPrimary)?.PhotoUrl,
			CreatedAt = source.CreatedAt,
			IsGoodDeal = CalculateIsGoodDeal(source)
		};

		public static IEnumerable<BuyerListingDto> ToBuyerDto(this IEnumerable<Listing> source)
			=> source.Select(l => l.ToBuyerDto());

		public static ListingDetailsDto ToDetailsDto(this Listing source) => new()
		{
			Id = source.Id,
			MakeName = source.Make?.Name ?? string.Empty,
			ModelName = source.Model?.Name ?? string.Empty,
			Year = source.Year,
			Mileage = source.Mileage,
			FuelType = source.FuelType.ToString(),
			Transmission = source.Transmission.ToString(),
			EngineSize = source.EngineSize,
			Color = source.Color,
			Description = source.Description,
			Location = source.Location.ToDisplayString(),
			ListingPrice = source.Price,
			IsGoodDeal = CalculateIsGoodDeal(source),
			Photos = MapPhotos(source.Photos),
			ConditionGrade = CalculateConditionGrade(source.ListingDefects),
			ChecklistCategories = MapChecklistCategories(source.ListingDefects),
			SellerName = source.Seller?.Name ?? string.Empty,
			ContactPhoneNumber = source.ContactPhoneNumber,
			WhatsAppNumber = source.WhatsAppNumber,
			PreferredContactMethod = source.PreferredContactMethod.ToString(),
			CreatedAt = source.CreatedAt
		};

		private static List<ListingPhotoDto> MapPhotos(ICollection<ListingPhoto>? photos)
		{
			if (photos is null || !photos.Any())
				return new List<ListingPhotoDto>();

			return photos
				.OrderByDescending(p => p.IsPrimary)
				.ThenBy(p => p.DisplayOrder)
				.Select(p => new ListingPhotoDto
				{
					Id = p.Id,
					PhotoUrl = p.PhotoUrl,
					IsPrimary = p.IsPrimary,
					DisplayOrder = p.DisplayOrder
				})
				.ToList();
		}

		private static string CalculateConditionGrade(ICollection<ListingDefect>? defects)
		{
			var count = defects?.Count ?? 0;

			return count switch
			{
				0 => "Excellent",
				<= 3 => "Good",
				<= 6 => "Fair",
				_ => "Poor"
			};
		}

		private static List<ConditionCategoryDetailDto> MapChecklistCategories(ICollection<ListingDefect>? defects)
		{
			if (defects is null || !defects.Any())
				return new List<ConditionCategoryDetailDto>();

			return defects
				.Where(ld => ld.ConditionDefect?.Category is not null)
				.GroupBy(ld => ld.ConditionDefect.Category.Name)
				.Select(group => new ConditionCategoryDetailDto
				{
					CategoryName = group.Key,
					Defects = group.Select(ld => new ConditionDefectItemDto
					{
						ItemName = ld.ConditionDefect.ItemName,
						Description = ld.ConditionDefect.Description
					}).ToList()
				})
				.ToList();
		}

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

		// ─── My Listings (Seller Dashboard) ───────────────────────────────

		public static MyListingDto ToMyListingDto(this Listing source)
		{
			var completionPercentage = CalculateCompletionPercentage(source);
			return new MyListingDto
			{
				Id = source.Id,
				MakeName = source.Make?.Name ?? string.Empty,
				ModelName = source.Model?.Name ?? string.Empty,
				Year = source.Year,
				ListingPrice = source.Price,
				Status = source.Status.ToString(),
				PrimaryPhotoUrl = source.Photos?.FirstOrDefault(p => p.IsPrimary)?.PhotoUrl,
				CreatedAt = source.CreatedAt,
				UpdatedAt = source.UpdatedAt,
				CompletionPercentage = completionPercentage,
				CanSubmit = completionPercentage == 100 && source.Status == ListingStatus.Draft
			};
		}

		public static IEnumerable<MyListingDto> ToMyListingDto(this IEnumerable<Listing> source)
			=> source.Select(l => l.ToMyListingDto());

		private static int CalculateCompletionPercentage(Listing listing)
		{
			int percentage = 0;

			// Step 1: Core data complete (25%)
			bool coreDataComplete =
				listing.MakeId != Guid.Empty
				&& listing.ModelId != Guid.Empty
				&& listing.Year > 0
				&& listing.Mileage > 0
				&& listing.EngineSize > 0
				&& !string.IsNullOrWhiteSpace(listing.Color)
				&& !string.IsNullOrWhiteSpace(listing.Description)
				&& !string.IsNullOrWhiteSpace(listing.ContactPhoneNumber)
				&& Enum.IsDefined(listing.FuelType)
				&& Enum.IsDefined(listing.Transmission)
				&& Enum.IsDefined(listing.Location);

			if (coreDataComplete) percentage += 25;

			// Step 2: Photos — at least 3 non-deleted (25%)
			if (listing.Photos?.Count(p => !p.IsDeleted) >= 3) percentage += 25;

			// Step 3: ML pricing generated (25%)
			bool hasMlPricing =
				listing.FairPrice is not null
				&& listing.NegotiationRangeLower is not null
				&& listing.NegotiationRangeUpper is not null
				&& !string.IsNullOrWhiteSpace(listing.ConfidenceLevel);

			if (hasMlPricing) percentage += 25;

			// Step 4: Seller price set (25%)
			if (listing.Price is not null) percentage += 25;

			return percentage;
		}
	}
}