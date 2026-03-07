using Karna.Core.Application.Abstraction.Initializers;
using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data;
using Karna.Infrastructure.Persistence._Data.Seeds;
using Karna.Infrastructure.Persistence._Data.Seeds.SeedDtos;
using Microsoft.EntityFrameworkCore;

namespace Karna.Infrastructure.Persistence._Initializers
{
	internal sealed class AppDbInitializer(AppDbContext _dbContext) : DbInitializer(_dbContext), IAppDbInitializer
	{
		public override async Task SeedDbAsync()
		{
			await SeedMakesAsync();
		}

		private async Task SeedMakesAsync()
		{
			if (await _dbContext.Makes.AnyAsync())
				return;

			var seedData = await SeedLoader.LoadAsync<MakeSeedDto>("makes.json");
			if (seedData.Count == 0)
				return;

			var makes = seedData.Select(s => new Make
			{
				Name = s.Name,
				NameAr = s.NameAr,
				LogoUrl = s.LogoUrl,
				Country = s.Country,
				CountryAr = s.CountryAr
			});

			await _dbContext.Makes.AddRangeAsync(makes);
			await _dbContext.SaveChangesAsync();
		}
	}
}
