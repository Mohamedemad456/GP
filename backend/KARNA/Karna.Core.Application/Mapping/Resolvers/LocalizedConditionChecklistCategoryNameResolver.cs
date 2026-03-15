using AutoMapper;
using Karna.Core.Application.Abstraction.DTOs.ConditionChecklistCategory;
using Karna.Core.Domain.Entities;
using System.Globalization;

namespace Karna.Core.Application.Mapping.Resolvers
{
	internal class LocalizedConditionChecklistCategoryNameResolver : IValueResolver<ConditionChecklistCategory, ConditionChecklistCategoryDto, string>
	{
		public string Resolve(ConditionChecklistCategory source, ConditionChecklistCategoryDto destination, string destMember, ResolutionContext context)
		{
			return IsArabic() ? source.NameAr : source.Name;
		}
		private static bool IsArabic() =>
			CultureInfo.CurrentCulture.TwoLetterISOLanguageName == "ar";
	}
}