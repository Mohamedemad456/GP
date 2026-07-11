using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Mapping
{
	internal static class ListingStatusHistoryMappingExtensions
	{
		public static ListingStatusHistoryDto ToDto(this ListingStatusHistory source) => new()
		{
			OldStatus = source.OldStatus,
			NewStatus = source.NewStatus,
			ChangedByUserId = source.ChangedByUserId,
			Reason = source.Reason,
			ChangedAt = source.ChangedAt
		};

		public static IEnumerable<ListingStatusHistoryDto> ToDto(this IEnumerable<ListingStatusHistory> source)
			=> source.Select(x => x.ToDto());
	}
}
