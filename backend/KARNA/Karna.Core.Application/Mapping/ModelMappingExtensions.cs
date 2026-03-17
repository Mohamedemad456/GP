using System.Globalization;
using Karna.Core.Application.Abstraction.DTOs.Model;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Mapping
{
	internal static class ModelMappingExtensions
	{
		public static ModelDto ToDto(this Model source)
		{
			var isArabic = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "ar";

			return new ModelDto
			{
				Id = source.Id,
				Name = isArabic ? source.NameAr : source.Name,
				IsActive = source.IsActive,
				MakeId = source.MakeId,
				MakeName = isArabic
					? (source.Make?.NameAr ?? source.Make?.Name ?? string.Empty)
					: (source.Make?.Name ?? source.Make?.NameAr ?? string.Empty),
				CreatedAt = source.CreatedAt,
				UpdatedAt = source.UpdatedAt
			};
		}

		public static IEnumerable<ModelDto> ToDto(this IEnumerable<Model> source) =>
			source.Select(x => x.ToDto());

		public static Model ToEntity(this CreateModelDto dto) => new()
		{
			Name = dto.Name,
			NameAr = dto.NameAr,
			MakeId = dto.MakeId
		};

		public static void ApplyTo(this UpdateModelDto dto, Model entity)
		{
			entity.Name = dto.Name;
			entity.NameAr = dto.NameAr;
			entity.MakeId = dto.MakeId;
		}
	}
}