using System.Globalization;
using Karna.Core.Application.Abstraction.DTOs.Make;
using Karna.Core.Domain.Entities;
using Microsoft.Extensions.Configuration;

namespace Karna.Core.Application.Mapping
{
	internal static class MakeMappingExtensions
	{
		public static MakeDto ToDto(this Make source, IConfiguration configuration)
		{
			var isArabic = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "ar";

			return new MakeDto
			{
				Id = source.Id,
				Name = isArabic ? source.NameAr : source.Name,
				Country = isArabic ? (source.CountryAr ?? source.Country) : source.Country,
				LogoUrl = BuildLogoUrl(source.LogoUrl, configuration),
				IsActive = source.IsActive,
				CreatedAt = source.CreatedAt,
				UpdatedAt = source.UpdatedAt
			};
		}

		public static IEnumerable<MakeDto> ToDto(this IEnumerable<Make> source, IConfiguration configuration) =>
			source.Select(x => x.ToDto(configuration));

		public static Make ToEntity(this CreateMakeDto dto) => new()
		{
			Name = dto.Name,
			NameAr = dto.NameAr,
			Country = dto.Country,
			CountryAr = dto.CountryAr
		};

		public static void ApplyTo(this UpdateMakeDto dto, Make entity)
		{
			entity.Name = dto.Name;
			entity.NameAr = dto.NameAr;
			entity.Country = dto.Country;
			entity.CountryAr = dto.CountryAr;
		}

		private static string BuildLogoUrl(string? relativePath, IConfiguration configuration)
		{
			if (string.IsNullOrWhiteSpace(relativePath))
				return string.Empty;

			var baseUrl = configuration["Urls:ApiBaseUrl"]?.TrimEnd('/');
			var path = relativePath.TrimStart('/');

			return string.IsNullOrWhiteSpace(baseUrl) ? path : $"{baseUrl}/{path}";
		}
	}
}