using Karna.Core.Domain._Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Persistence._Data.Interceptors
{
	public class AuditableEntityInterceptor: SaveChangesInterceptor
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

			var entries = dbContext.ChangeTracker.Entries<BaseAuditableEntity>()
				.Where(e => e.State is EntityState.Added or EntityState.Modified);
			foreach (var entry in entries)
			{
				var now = DateTime.UtcNow;
				if (entry.State is EntityState.Added)
				{
					entry.Property(e => e.CreatedAt).CurrentValue = now;
				}
				if (entry.State is EntityState.Modified)
				{

					entry.Property(e => e.UpdatedAt).CurrentValue = now;
				}
			}

			// Soft Delete: convert Delete -> Update with IsDeleted = true
			var deletedEntries = dbContext.ChangeTracker.Entries<SoftDeleteEntity>()
				.Where(e => e.State is EntityState.Deleted);
			foreach (var entry in deletedEntries)
			{
				entry.State = EntityState.Modified;
				entry.Entity.IsDeleted = true;
			}
		}
	}
}
