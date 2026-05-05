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
			await SeedConditionDefectsAsync();
		}

		private async Task SeedMakesAsync()
		{
			var seedData = await SeedLoader.LoadAsync<MakeSeedDto>("makes.json");
			if (seedData.Count == 0)
				return;

			var existingNames = (await _dbContext.Makes
				.AsNoTracking()
				.Select(m => m.Name)
				.ToListAsync())
				.ToHashSet();

			var newMakes = seedData
				.Where(s => !existingNames.Contains(s.Name))
				.Select(s => new Make
				{
					Name = s.Name,
					NameAr = s.NameAr,
					LogoUrl = s.LogoUrl,
					Country = s.Country,
					CountryAr = s.CountryAr
				})
				.ToList();

			if (newMakes.Count == 0)
				return;

			await _dbContext.Makes.AddRangeAsync(newMakes);
			await _dbContext.SaveChangesAsync();
		}

		private async Task SeedModelsAsync()
		{
			var seedData = await SeedLoader.LoadAsync<ModelSeedDto>("models.json");
			if (seedData.Count == 0)
				return;

			var makeLookup = await _dbContext.Makes
				.AsNoTracking()
				.ToDictionaryAsync(m => m.Name, m => m.Id);

			var existingModels = await _dbContext.Models
				.AsNoTracking()
				.Select(m => new { m.MakeId, m.Name })
				.ToListAsync();

			var existingSet = new HashSet<(Guid MakeId, string Name)>(
				existingModels.Select(m => (m.MakeId, m.Name)));

			var newModels = seedData
				.Where(s => makeLookup.ContainsKey(s.MakeName))
				.Select(s => new Model
				{
					Name = s.Name,
					NameAr = s.NameAr,
					MakeId = makeLookup[s.MakeName]
				})
				.Where(m => !existingSet.Contains((m.MakeId, m.Name)))
				.ToList();

			if (newModels.Count == 0)
				return;

			await _dbContext.Models.AddRangeAsync(newModels);
			await _dbContext.SaveChangesAsync();
		}

		private async Task SeedConditionChecklistCategoriesAsync()
		{
			var seedData = await SeedLoader.LoadAsync<ConditionChecklistCategorySeedDto>("condition-checklist-categories.json");
			if (seedData.Count == 0)
				return;

			var existingNames = (await _dbContext.ConditionChecklistCategories
				.AsNoTracking()
				.Select(c => c.Name)
				.ToListAsync())
				.ToHashSet();

			var newCategories = seedData
				.Where(s => !existingNames.Contains(s.Name))
				.Select(s => new ConditionChecklistCategory
				{
					Name = s.Name,
					NameAr = s.NameAr
				})
				.ToList();

			if (newCategories.Count == 0)
				return;

			await _dbContext.ConditionChecklistCategories.AddRangeAsync(newCategories);
			await _dbContext.SaveChangesAsync();
		}

		private async Task SeedConditionDefectsAsync()
		{
			var seedData = await SeedLoader.LoadAsync<ConditionDefectSeedDto>("condition-defects.json");
			if (seedData.Count == 0)
				return;

			var categoryLookup = await _dbContext.ConditionChecklistCategories
				.AsNoTracking()
				.ToDictionaryAsync(c => c.Name, c => c.Id);

			var existingDefects = await _dbContext.ConditionDefects
				.AsNoTracking()
				.Select(d => new { d.CategoryId, d.ItemName })
				.ToListAsync();

			var existingSet = new HashSet<(Guid CategoryId, string ItemName)>(
				existingDefects.Select(d => (d.CategoryId, d.ItemName)));

			var newDefects = seedData
				.Where(s => categoryLookup.ContainsKey(s.CategoryName))
				.Select(s => new ConditionDefect
				{
					ItemName = s.ItemName,
					ItemNameAr = s.ItemNameAr,
					Description = s.Description,
					DescriptionAr = s.DescriptionAr,
					CategoryId = categoryLookup[s.CategoryName]
				})
				.Where(d => !existingSet.Contains((d.CategoryId, d.ItemName)))
				.ToList();

			if (newDefects.Count == 0)
				return;

			await _dbContext.ConditionDefects.AddRangeAsync(newDefects);
			await _dbContext.SaveChangesAsync();
		}
	}
}

