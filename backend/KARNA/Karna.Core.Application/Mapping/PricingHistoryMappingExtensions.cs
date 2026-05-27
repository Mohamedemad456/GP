using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Mapping
{
	internal static class PricingHistoryMappingExtensions
	{
		public static PricingHistoryDto ToDto(this PricingHistory source) => new()
		{
			OldPrice = source.OldPrice,
			NewPrice = source.NewPrice,
			OldFairPrice = source.OldFairPrice,
			NewFairPrice = source.NewFairPrice,
			ChangeReason = source.ChangeReason,
			ChangedByUserId = source.ChangedByUserId,
			ChangedAt = source.ChangedAt
		};

		public static IEnumerable<PricingHistoryDto> ToDto(this IEnumerable<PricingHistory> source)
			=> source.Select(x => x.ToDto());
	}
}
