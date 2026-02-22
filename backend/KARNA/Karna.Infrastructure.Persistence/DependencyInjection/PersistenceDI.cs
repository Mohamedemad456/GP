using Karna.Core.Application.Abstraction.Initializers;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Infrastructure.Persistence._Data;
using Karna.Infrastructure.Persistence._Data.Interceptors;
using Karna.Infrastructure.Persistence._Data.Repositories;
using Karna.Infrastructure.Persistence._Identity;
using Karna.Infrastructure.Persistence._Initializers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Persistence.DependencyInjection
{
	public static class PersistenceDI
	{
		public static IServiceCollection AddPersistenceServices(this IServiceCollection services, IConfiguration configuration)
		{
			services.AddDbContext<AppDbContext>((serviceprovider, optionsBuilder) =>
			{
				optionsBuilder
				.UseLazyLoadingProxies()
				.UseSqlServer(configuration.GetConnectionString("DefaultConnection"))
				.AddInterceptors(serviceprovider.GetRequiredService<AuditableEntityInterceptor>());
			});

			services.AddScoped<IAppDbInitializer, AppDbInitializer>();
			services.AddScoped<AuditableEntityInterceptor>();



			services.AddDbContext<AppIdentityDbContext>((serviceprovider, optionsBuilder) =>
			{
				optionsBuilder
				.UseLazyLoadingProxies()
				.UseSqlServer(configuration.GetConnectionString("DefaultConnection"));
			});

			services.AddScoped<IAppIdentityDbInitializer, AppIdentityDbInitializer>();

			services.AddScoped<IUnitOfWork, UnitOfWork>();
			//services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));

			return services;
		}
	}
}
