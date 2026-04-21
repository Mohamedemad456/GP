using System.Globalization;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Mapping
{
	internal static class ListingDefectMappingExtensions
	{
		public static ListingDefectDto ToDto(this ListingDefect source)
		{
			var isArabic = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "ar";

			return new ListingDefectDto
			{
				ConditionDefectId = source.ConditionDefectId,
				ItemName = isArabic
					? (source.ConditionDefect?.ItemNameAr ?? source.ConditionDefect?.ItemName ?? string.Empty)
					: (source.ConditionDefect?.ItemName ?? source.ConditionDefect?.ItemNameAr ?? string.Empty),
				CategoryName = isArabic
					? (source.ConditionDefect?.Category?.NameAr ?? source.ConditionDefect?.Category?.Name ?? string.Empty)
					: (source.ConditionDefect?.Category?.Name ?? source.ConditionDefect?.Category?.NameAr ?? string.Empty)
			};
		}

		public static IEnumerable<ListingDefectDto> ToDto(this IEnumerable<ListingDefect> source) =>
			source.Select(x => x.ToDto());
	}
}
