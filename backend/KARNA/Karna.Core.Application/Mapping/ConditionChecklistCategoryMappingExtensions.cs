using System.Globalization;
using Karna.Core.Application.Abstraction.DTOs.ConditionChecklistCategory;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Mapping
{
	internal static class ConditionChecklistCategoryMappingExtensions
	{
		public static ConditionChecklistCategoryDto ToDto(this ConditionChecklistCategory source)
		{
			var isArabic = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "ar";

			return new ConditionChecklistCategoryDto
			{
				Id = source.Id,
				Name = isArabic ? source.NameAr : source.Name,
				IsActive = source.IsActive,
				CreatedAt = source.CreatedAt,
				UpdatedAt = source.UpdatedAt
			};
		}

		public static IEnumerable<ConditionChecklistCategoryDto> ToDto(this IEnumerable<ConditionChecklistCategory> source) =>
			source.Select(x => x.ToDto());

		public static ConditionChecklistCategory ToEntity(this CreateConditionChecklistCategoryDto dto) => new()
		{
			Name = dto.Name,
			NameAr = dto.NameAr
		};

		public static void ApplyTo(this UpdateConditionChecklistCategoryDto dto, ConditionChecklistCategory entity)
		{
			entity.Name = dto.Name;
			entity.NameAr = dto.NameAr;
		}
	}
}