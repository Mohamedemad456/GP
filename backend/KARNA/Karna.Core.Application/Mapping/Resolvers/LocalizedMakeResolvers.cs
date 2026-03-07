using AutoMapper;
using Karna.Core.Application.Abstraction.DTOs.Make;
using Karna.Core.Domain.Entities;
using System.Globalization;

namespace Karna.Core.Application.Mapping.Resolvers
{
	public class LocalizedMakeNameResolver : IValueResolver<Make, MakeDto, string>
	{
		public string Resolve(Make source, MakeDto destination, string destMember, ResolutionContext context)
		{
			return IsArabic() ? source.NameAr : source.Name;
		}

		private static bool IsArabic() =>
			CultureInfo.CurrentCulture.TwoLetterISOLanguageName == "ar";
	}

	public class LocalizedMakeCountryResolver : IValueResolver<Make, MakeDto, string?>
	{
		public string? Resolve(Make source, MakeDto destination, string? destMember, ResolutionContext context)
		{
			return IsArabic() ? (source.CountryAr ?? source.Country) : source.Country;
		}

		private static bool IsArabic() =>
			CultureInfo.CurrentCulture.TwoLetterISOLanguageName == "ar";
	}
}