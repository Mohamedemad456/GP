using Karna.Core.Application.Abstraction.Initializers;
using Karna.Infrastructure.Persistence._Data;
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
		public static IServiceCollection AddPersistenceDI(this IServiceCollection services, IConfiguration configuration)
		{
			services.AddDbContext<AppDbContext>(options =>
			{
				options.UseSqlServer(configuration.GetConnectionString("DefaultConnection"));
			});

			services.AddScoped<IStoreDbInitializer, StoreDbInitializer>();

			return services;
		}
	}
}
