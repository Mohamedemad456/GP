using AutoMapper;
using Karna.Core.Application.Abstraction.DTOs.Make;
using Karna.Core.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace Karna.Core.Application.Mapping.Resolvers
{
	public class MakesLogoUrlResolver(IConfiguration configuration)
		: IValueResolver<Make, MakeDto, string?>
	{
		public string? Resolve(Make source, MakeDto destination, string? destMember, ResolutionContext context)
		{
			if (!string.IsNullOrEmpty(source.LogoUrl))
				return $"{configuration["Urls:ApiBaseUrl"]}/{source.LogoUrl}";

			return string.Empty;
		}
	}
}