using Karna.Infrastructure.Identity;
using Karna.Infrastructure.Persistence._Identity;
using Microsoft.AspNetCore.Identity;

namespace Karna.APIs.Extensions
{
	public static class IdentityExtension
	{
		public static IServiceCollection AddIdentityServices(this IServiceCollection services, IConfiguration configuration)
		{

			services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(identityOptions =>
			{
				identityOptions.Password.RequiredLength = 8;
				identityOptions.Password.RequireUppercase = true;
				identityOptions.Password.RequireLowercase = true;
				identityOptions.Password.RequireDigit = true;
				identityOptions.Password.RequireNonAlphanumeric = true;

				identityOptions.User.RequireUniqueEmail = true;
				identityOptions.Lockout.AllowedForNewUsers = true;


			})
			.AddEntityFrameworkStores<AppIdentityDbContext>().AddDefaultTokenProviders();

			return services;
		}


	}
}
