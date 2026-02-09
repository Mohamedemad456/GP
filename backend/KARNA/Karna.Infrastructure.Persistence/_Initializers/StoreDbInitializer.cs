using Karna.Core.Application.Abstraction.Initializers;
using Karna.Infrastructure.Persistence._Data;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Persistence._Initializers
{
	internal class StoreDbInitializer(AppDbContext _dbContext) : DbInitializer(_dbContext), IStoreDbInitializer
	{
		public override async Task SeedDbAsync()
		{
			// TODO: Add seed data here
		}
	}
}
