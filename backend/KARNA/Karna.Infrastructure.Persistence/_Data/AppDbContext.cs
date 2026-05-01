using Karna.Core.Domain._Common;
using Karna.Core.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace Karna.Infrastructure.Persistence._Data
{
	public class AppDbContext : DbContext
	{
		public DbSet<User> Users { get; set; } = null!;
		public DbSet<RefreshToken> RefreshTokens { get; set; } = null!;
		public DbSet<Make> Makes { get; set; } = null!;
		public DbSet<Model> Models { get; set; } = null!;
		public DbSet<Listing> Listings { get; set; } = null!;
		public DbSet<ConditionChecklistCategory> ConditionChecklistCategories { get; set; } = null!;
		public DbSet<ConditionDefect> ConditionDefects { get; set; } = null!;
		public DbSet<ListingDefect> ListingDefects { get; set; } = null!;
		public DbSet<ListingStatusHistory> ListingStatusHistories { get; set; } = null!;

		public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
		{
		}

		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			base.OnModelCreating(modelBuilder);
			modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

			foreach (var entityType in modelBuilder.Model.GetEntityTypes())
			{
				if (typeof(ISoftDelete).IsAssignableFrom(entityType.ClrType))
				{
					var parameter = Expression.Parameter(entityType.ClrType, "e");
					var property = Expression.Property(parameter, nameof(ISoftDelete.IsDeleted));
					var filter = Expression.Lambda(
						Expression.Equal(property, Expression.Constant(false)),
						parameter);

					modelBuilder.Entity(entityType.ClrType).HasQueryFilter(filter);
				}
			}
		}
	}
}
