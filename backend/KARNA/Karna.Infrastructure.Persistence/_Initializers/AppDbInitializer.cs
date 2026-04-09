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
			await SeedModelsAsync();
			await SeedConditionChecklistCategoriesAsync();
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

		private async Task SeedModelsAsync()
		{
			if (await _dbContext.Models.AnyAsync())
				return;

			var seedData = await SeedLoader.LoadAsync<ModelSeedDto>("models.json");
			if (seedData.Count == 0)
				return;

			var makeLookup = await _dbContext.Makes
				.AsNoTracking()
				.ToDictionaryAsync(m => m.Name, m => m.Id);

			var models = seedData
				.Where(s => makeLookup.ContainsKey(s.MakeName))
				.Select(s => new Model
				{
					Name = s.Name,
					NameAr = s.NameAr,
					MakeId = makeLookup[s.MakeName]
				});

			await _dbContext.Models.AddRangeAsync(models);
			await _dbContext.SaveChangesAsync();
		}

		private async Task SeedConditionChecklistCategoriesAsync()
		{
			if (await _dbContext.ConditionChecklistCategories.AnyAsync())
				return;

			var seedData = await SeedLoader.LoadAsync<ConditionChecklistCategorySeedDto>("condition-checklist-categories.json");
			if (seedData.Count == 0)
				return;

			var categories = seedData.Select(s => new ConditionChecklistCategory
			{
				Name = s.Name,
				NameAr = s.NameAr,
				Description = s.Description
			});

			await _dbContext.ConditionChecklistCategories.AddRangeAsync(categories);
			await _dbContext.SaveChangesAsync();
		}
	}
}

