using Karna.Core.Application.Abstraction.Initializers;
using Karna.Infrastructure.Persistence._Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Persistence._Initializers
{
	internal abstract class DbInitializer(AppDbContext _dbContext) : IDbInitializer
	{
		
		public virtual async Task InitializeDbAsync()
		{
			var pendeingMigrations = await _dbContext.Database.GetPendingMigrationsAsync();

			if(pendeingMigrations.Any())
			{
				await _dbContext.Database.MigrateAsync(); // Update the database to the latest version
			}
		}

		public abstract Task SeedDbAsync();
	}
}
