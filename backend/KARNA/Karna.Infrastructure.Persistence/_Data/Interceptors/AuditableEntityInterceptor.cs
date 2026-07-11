using Karna.Core.Domain._Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Karna.Infrastructure.Persistence._Data.Interceptors
{
	public class AuditableEntityInterceptor : SaveChangesInterceptor
	{
		public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
		{
			UpdateEntities(eventData.Context);
			return base.SavingChanges(eventData, result);
		}

		public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
		{
			UpdateEntities(eventData.Context);
			return base.SavingChangesAsync(eventData, result, cancellationToken);
		}

		private static void UpdateEntities(DbContext? dbContext)
		{
			if (dbContext is null) return;

			var deletedEntries = dbContext.ChangeTracker.Entries<ISoftDelete>()
				.Where(e => e.State is EntityState.Deleted);
			foreach (var entry in deletedEntries)
			{
				entry.State = EntityState.Modified;
				entry.Entity.IsDeleted = true;
			}

			var auditableEntries = dbContext.ChangeTracker.Entries<BaseAuditableEntity>()
				.Where(e => e.State is EntityState.Added or EntityState.Modified);
			foreach (var entry in auditableEntries)
			{
				var now = DateTime.UtcNow;
				if (entry.State is EntityState.Added)
				{
					entry.Property(e => e.CreatedAt).CurrentValue = now;
					entry.Property(e => e.UpdatedAt).CurrentValue = now;
				}
				if (entry.State is EntityState.Modified)
				{
					entry.Property(e => e.UpdatedAt).CurrentValue = now;
				}
			}
		}
	}
}
