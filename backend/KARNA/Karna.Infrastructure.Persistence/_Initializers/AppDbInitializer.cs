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
			if (!await _dbContext.Makes.AnyAsync())
			{

				var makesData = await SeedLoader.LoadAsync<MakeSeedDto>("makes.json");

				if (makesData?.Count > 0)
				{

					var makes = makesData.Select(s => new Make
					{
						Name = s.Name,
						LogoUrl = s.LogoUrl,
						Country = s.Country
					});

					await _dbContext.Makes.AddRangeAsync(makes);
					await _dbContext.SaveChangesAsync();
				}
			}

		}
	}
}
