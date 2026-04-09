using System.Globalization;
using Karna.Core.Application.Abstraction.DTOs.ConditionDefect;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Mapping
{
	internal static class ConditionDefectMappingExtensions
	{
		public static ConditionDefectDto ToDto(this ConditionDefect source)
		{
			var isArabic = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "ar";

			return new ConditionDefectDto
			{
				Id = source.Id,
				ItemName = isArabic ? source.ItemNameAr : source.ItemName,
				Description = isArabic ? source.DescriptionAr : source.Description,
				IsActive = source.IsActive,
				CategoryId = source.CategoryId,
				CategoryName = isArabic
					? (source.Category?.NameAr ?? source.Category?.Name ?? string.Empty)
					: (source.Category?.Name ?? source.Category?.NameAr ?? string.Empty),
				CreatedAt = source.CreatedAt,
				UpdatedAt = source.UpdatedAt
			};
		}

		public static IEnumerable<ConditionDefectDto> ToDto(this IEnumerable<ConditionDefect> source) =>
			source.Select(x => x.ToDto());

		public static ConditionDefect ToEntity(this CreateConditionDefectDto dto) => new()
		{
			ItemName = dto.ItemName,
			ItemNameAr = dto.ItemNameAr,
			Description = dto.Description,
			DescriptionAr = dto.DescriptionAr,
			CategoryId = dto.CategoryId
		};

		public static void ApplyTo(this UpdateConditionDefectDto dto, ConditionDefect entity)
		{
			entity.ItemName = dto.ItemName;
			entity.ItemNameAr = dto.ItemNameAr;
			entity.Description = dto.Description;
			entity.DescriptionAr = dto.DescriptionAr;
			entity.CategoryId = dto.CategoryId;
		}
	}
}
