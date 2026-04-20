using FluentValidation;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;

namespace Karna.Core.Application.DependencyInjection
{
	public static class ApplicationDI
	{
		public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration configuration)
		{
			services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

			services.AddScoped<IAuthService, AuthService>();
			services.AddScoped<IUserService, UserService>();
			services.AddScoped<IMakeService, MakeService>();
			services.AddScoped<IModelService, ModelService>();
			services.AddScoped<IListingService, ListingService>();
			services.AddScoped<ILookupService, LookupService>();
			services.AddScoped<IConditionChecklistCategoryService, ConditionChecklistCategoryService>();
			services.AddScoped<IConditionDefectService, ConditionDefectService>();
            services.AddScoped<IListingPhotoService, ListingPhotoService>();



            return services;
		}
	}
}
