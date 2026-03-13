using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using AutoMapper;
using Karna.Core.Application.Abstraction.DTOs.Model;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Mapping.Resolvers
{
    internal class LocalizedModelNameResolver : IValueResolver<Model, ModelDto, string>
    {
        public string Resolve(Model source, ModelDto destination, string destMember, ResolutionContext context)
        {
            return IsArabic() ? source.NameAr : source.Name;
        }

        private static bool IsArabic() =>
            CultureInfo.CurrentCulture.TwoLetterISOLanguageName == "ar";
    }

}
